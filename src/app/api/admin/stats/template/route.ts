import ExcelJS from "exceljs";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OMCITE Arena";
    const sheet = workbook.addWorksheet("Результаты");
    sheet.columns = [
      { header: "Игровой ID", key: "game_id", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "ID мероприятия", key: "event_id", width: 38 },
      { header: "ID сессии", key: "session_id", width: 38 },
      { header: "Киллы", key: "kills", width: 12 },
      { header: "Матчи", key: "matches", width: 12 },
      { header: "Комментарий", key: "note", width: 40 },
    ];
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF087EAD" },
    };
    sheet.addRow({
      game_id: "123456789",
      email: "player@example.com",
      event_id: "00000000-0000-0000-0000-000000000000",
      session_id: "00000000-0000-0000-0000-000000000000",
      kills: 10,
      matches: 4,
      note: "Пример — удалите эту строку перед импортом",
    });

    for (let row = 2; row <= 1000; row += 1) {
      sheet.getCell(`E${row}`).dataValidation = {
        type: "whole",
        operator: "greaterThanOrEqual",
        formulae: [0],
        allowBlank: false,
      };
      sheet.getCell(`F${row}`).dataValidation = {
        type: "whole",
        operator: "greaterThanOrEqual",
        formulae: [0],
        allowBlank: false,
      };
    }

    const instructions = workbook.addWorksheet("Инструкция");
    instructions.getColumn(1).width = 115;
    [
      "OMCITE Arena — импорт статистики",
      "Игрок определяется сначала по игровому ID, затем по email.",
      "ID мероприятия обязателен. ID сессии рекомендуется указывать для мероприятий с расписанием.",
      "Киллы и матчи — целые неотрицательные числа.",
      "Импорт автоматически подтверждает статистику и сохраняет журнал для отката.",
    ].forEach((value) => instructions.addRow([value]));
    instructions.getRow(1).font = { bold: true, size: 16 };

    const output = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=omcite-stats-template.xlsx",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
