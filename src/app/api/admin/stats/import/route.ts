import ExcelJS from "exceljs";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const headerAliases: Record<string, string> = {
  "игровой id": "game_id",
  "game id": "game_id",
  "game_id": "game_id",
  "email": "email",
  "почта": "email",
  "id мероприятия": "event_id",
  "event id": "event_id",
  "event_id": "event_id",
  "id сессии": "session_id",
  "session id": "session_id",
  "session_id": "session_id",
  "киллы": "kills",
  "kills": "kills",
  "матчи": "matches",
  "matches": "matches",
  "matches_played": "matches",
  "комментарий": "note",
  "note": "note",
};

function cellText(cell: ExcelJS.Cell) {
  return String(cell.text ?? "").trim();
}

function parseNonNegativeInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Выберите Excel-файл" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "Файл превышает 10 МБ" }, { status: 413 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return Response.json({ error: "Поддерживается только формат .xlsx" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return Response.json({ error: "В файле нет строк для импорта" }, { status: 400 });
    }

    const columns = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, columnNumber) => {
      const normalized = cellText(cell).toLowerCase();
      const key = headerAliases[normalized];
      if (key) columns.set(key, columnNumber);
    });
    for (const required of ["game_id", "event_id", "kills", "matches"]) {
      if (!columns.has(required)) {
        return Response.json({ error: `Не найдена обязательная колонка: ${required}` }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    const { data: importLog, error: logError } = await supabase
      .from("excel_import_logs")
      .insert({ admin_id: auth.user.id, file_name: file.name, total_rows: sheet.rowCount - 1 })
      .select("id")
      .single();
    if (logError || !importLog) throw logError ?? new Error("Не удалось создать журнал импорта");

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, game_id");
    if (profilesError) throw profilesError;
    const profileByGameId = new Map(
      (profiles ?? []).filter((profile) => profile.game_id).map((profile) => [String(profile.game_id), profile.id]),
    );

    const { data: authUsers, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    const userByEmail = new Map(
      authUsers.users.filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user.id]),
    );

    let successfulRows = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (!row.hasValues) continue;

      try {
        const get = (key: string) => {
          const column = columns.get(key);
          return column ? cellText(row.getCell(column)) : "";
        };
        const gameId = get("game_id");
        const email = get("email").toLowerCase();
        const eventId = get("event_id");
        const sessionId = get("session_id") || null;
        const kills = parseNonNegativeInteger(get("kills"));
        const matches = parseNonNegativeInteger(get("matches"));
        const note = get("note");
        const userId = profileByGameId.get(gameId) ?? userByEmail.get(email);

        if (!userId) throw new Error("Игрок не найден по игровому ID или email");
        if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new Error("Некорректный ID мероприятия");
        if (sessionId && !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("Некорректный ID сессии");
        if (kills === null || matches === null) throw new Error("Киллы и матчи должны быть целыми числами от 0");

        let existingQuery = supabase
          .from("player_stats")
          .select("id, kills, matches_played, status, moderator_id, session_id")
          .eq("user_id", userId)
          .eq("event_id", eventId);
        existingQuery = sessionId
          ? existingQuery.eq("session_id", sessionId)
          : existingQuery.is("session_id", null);
        const { data: existingRows, error: existingError } = await existingQuery
          .order("updated_at", { ascending: false })
          .limit(1);
        if (existingError) throw existingError;
        const existing = existingRows?.[0] ?? null;
        const values = {
          user_id: userId,
          event_id: eventId,
          session_id: sessionId,
          kills,
          matches_played: matches,
          status: "approved",
          moderator_id: auth.user.id,
          corrected_by: auth.user.id,
          correction_note: note || `Импорт ${file.name}`,
          updated_at: new Date().toISOString(),
        };

        let statId: string;
        if (existing) {
          const { error: updateError } = await supabase.from("player_stats").update(values).eq("id", existing.id);
          if (updateError) throw updateError;
          statId = existing.id;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("player_stats")
            .insert(values)
            .select("id")
            .single();
          if (insertError || !inserted) throw insertError ?? new Error("Не удалось добавить статистику");
          statId = inserted.id;
        }

        const { error: changeError } = await supabase.from("stats_change_logs").insert({
          import_id: importLog.id,
          player_stat_id: statId,
          user_id: userId,
          event_id: eventId,
          session_id: sessionId,
          changed_by: auth.user.id,
          change_type: existing ? "update" : "insert",
          before_values: existing,
          after_values: values,
          note: note || null,
        });
        if (changeError) throw changeError;
        successfulRows += 1;
      } catch (error) {
        errors.push({ row: rowNumber, error: error instanceof Error ? error.message : "Неизвестная ошибка" });
      }
    }

    const status = successfulRows > 0 ? "completed" : "failed";
    await supabase.from("excel_import_logs").update({
      status,
      successful_rows: successfulRows,
      failed_rows: errors.length,
      errors,
    }).eq("id", importLog.id);

    return Response.json({
      success: successfulRows > 0,
      importId: importLog.id,
      successfulRows,
      failedRows: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
