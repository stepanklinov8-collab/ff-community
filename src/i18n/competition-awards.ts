import type {Locale} from "./messages";
const ru = {
 sessionMvp:"MVP сессии", selectionHelp:"Больше личных убийств за сессию, затем выше место команды. При полном равенстве выберите игрока. Если у команды заполнен только общий итог, MVP не начисляется.",
 tieChoice:"Выбор MVP при равенстве (организатор или администратор)", choosePlayer:"Выберите игрока",
 mvpAwards:"Награды MVP", teamAwards:"Награды за топ-2", ratingBonus:"Бонус к рейтингу", placementBonus:"За итоговые места", totalBonus:"Все личные бонусы", includedInValue:"учтён в рейтинге и стоимости",
 trainingStreak:"Серия тренировок", tournamentStreak:"Серия турниров", participant:"Участник", gameWins:"Первые места в играх",
};
const kk:typeof ru = {
 sessionMvp:"Сессия MVP ойыншысы", selectionHelp:"Алдымен сессиядағы жеке өлтірулер саны, содан кейін команданың орны есептеледі. Толық теңдік болса, ойыншыны таңдаңыз. Команданың тек жалпы нәтижесі толтырылса, MVP берілмейді.",
 tieChoice:"Теңдік кезіндегі MVP таңдауы (ұйымдастырушы немесе әкімші)", choosePlayer:"Ойыншыны таңдаңыз",
 mvpAwards:"MVP марапаттары", teamAwards:"Топ-2 марапаттары", ratingBonus:"Рейтинг бонусы", placementBonus:"Қорытынды орындар үшін", totalBonus:"Барлық жеке бонустар", includedInValue:"рейтинг пен құнға енгізілген",
 trainingStreak:"Жаттығулар сериясы", tournamentStreak:"Турнирлер сериясы", participant:"Қатысушы", gameWins:"Ойындардағы бірінші орындар",
};
const ky:typeof ru = {
 sessionMvp:"Сессиянын MVP оюнчусу", selectionHelp:"Адегенде сессиядагы жеке өлтүрүүлөрдүн саны, андан кийин команданын орду эсептелет. Толук теңдик болсо, оюнчуну тандаңыз. Команданын жалпы жыйынтыгы гана толтурулса, MVP берилбейт.",
 tieChoice:"Теңдик учурунда MVP тандоо (уюштуруучу же администратор)", choosePlayer:"Оюнчуну тандаңыз",
 mvpAwards:"MVP сыйлыктары", teamAwards:"Топ-2 сыйлыктары", ratingBonus:"Рейтинг бонусу", placementBonus:"Жыйынтык орундар үчүн", totalBonus:"Бардык жеке бонустар", includedInValue:"рейтингге жана баага кошулган",
 trainingStreak:"Машыгуулар сериясы", tournamentStreak:"Турнирлер сериясы", participant:"Катышуучу", gameWins:"Оюндардагы биринчи орундар",
};
export function awardText(locale:Locale){return locale==="kk"?kk:locale==="ky"?ky:ru;}
