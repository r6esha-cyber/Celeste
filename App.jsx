import React, { useState, useEffect, useMemo, useRef } from "react";

/* ==================================================================
 * Celeste — period & hormone tracker
 * Palette: #c54b8c (rose) = logged / certain, #fb74a8 (pink) = predicted / estimated
 * ================================================================== */

/* ---------------------------- date helpers ---------------------------- */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const addISO = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); };
const diffISO = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS_MON = ["M","T","W","T","F","S","S"];
const WEEKDAYS_SUN = ["S","M","T","W","T","F","S"];
/* Display preferences the pure date helpers need. App syncs this from settings. */
const FMT = { dateFormat: "d-mmm", firstDay: 1 };
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const prettyDate = (s) => {
  const d = fromISO(s);
  if (FMT.dateFormat === "dmy") return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  if (FMT.dateFormat === "mdy") return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  if (FMT.dateFormat === "ymd") return s;
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};
const longDate = (s) => { const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

function monthGrid(year, month) {
  const first = new Date(year, month, 1, 12);
  const lead = (first.getDay() - FMT.firstDay + 7) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(iso(new Date(year, month, d, 12)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ------------------------------ vocabulary ------------------------------ */
const FLOWS = [{ id: "light", label: "Light" }, { id: "medium", label: "Medium" }, { id: "heavy", label: "Heavy" }];
const flowLabel = (id) => t("flow" + String(id || "none").charAt(0).toUpperCase() + String(id || "none").slice(1));

const MED_EXTRAS = ["Painkiller","Vitamins","Iron","Supplement","Other"];

const BC_METHODS = [
  { id: "none", label: "None", hormonal: false, daily: false },
  { id: "combined", label: "Combined pill", hormonal: true, daily: true },
  { id: "mini", label: "Mini pill (POP)", hormonal: true, daily: true },
  { id: "hormonal-iud", label: "Hormonal IUD", hormonal: true, daily: false },
  { id: "copper-iud", label: "Copper IUD", hormonal: false, daily: false },
  { id: "implant", label: "Implant", hormonal: true, daily: false },
  { id: "injection", label: "Injection", hormonal: true, daily: false },
  { id: "ring", label: "Vaginal ring", hormonal: true, daily: false },
  { id: "patch", label: "Patch", hormonal: true, daily: false },
  { id: "barrier", label: "Condoms / barrier", hormonal: false, daily: false },
];
const bcMethod = (id) => BC_METHODS.find((m) => m.id === id) || BC_METHODS[0];

/* ------------------------------- content ------------------------------- */
const HORMONES = [
  { id: "e", name: "Oestrogen", colour: "#fb74a8",
    what: "Builds the uterine lining and drives the run-up to ovulation. It lifts serotonin and collagen, which is why the days before ovulation often bring clearer skin, sharper words and more social energy.",
    high: "You may feel your most outgoing and physically capable. Skin is usually at its best.",
    low: "Energy, mood and skin can all dip. Headaches are more common when it falls quickly." },
  { id: "p", name: "Progesterone", colour: "#c54b8c",
    what: "Released by the follicle after it has ovulated, to hold the lining in place. It is calming and mildly sedating, raises your resting temperature slightly, and slows the gut.",
    high: "Often a settled, quieter feeling — but also bloating, warmth and heavier sleep.",
    low: "Before ovulation it is meant to be low. A sharp fall at the end of a cycle is what starts your period." },
  { id: "lh", name: "LH", colour: "#8d6b79",
    what: "Sits low most of the month, then surges sharply to release the egg within roughly 24 to 36 hours. Ovulation test strips are measuring this surge.",
    high: "The surge itself is brief. Some people notice a one-sided twinge as the egg is released.",
    low: "Baseline for most of the cycle." },
  { id: "t", name: "Testosterone", colour: "#d9a3ba",
    what: "Present in small amounts throughout, peaking around ovulation. Linked to libido, drive and how well muscle responds to training.",
    high: "Often a noticeable lift in confidence, libido and strength.",
    low: "Steady background level." },
];

const phaseName = (k) => t("ph" + k.charAt(0).toUpperCase() + k.slice(1));
const phaseTag = (k) => t({ menstrual:"tagBleeding", follicular:"tagBuilding", fertile:"tagPeak",
  luteal:"tagWinding", late:"tagPMS" }[k]);

const PHASES = {
  menstrual: {
    key: "menstrual", name: "Menstrual", tag: "Bleeding",
    hormone: "Oestrogen and progesterone are both at their floor. It was the fall in progesterone that started the bleed.",
    body: ["Cramping as the uterus contracts","Lower back and thigh ache","Looser stools for many people","Headaches, most often on day 1 or 2"],
    feel: ["Energy usually bottoms out on the first two days, then starts climbing","Mood often settles once bleeding begins","Pain sensitivity runs higher than usual"],
    care: ["Heat on the lower abdomen or back for cramping","Gentle movement — walking, stretching — over hard training","Iron-rich food supports what you lose in blood","Rest here is not lost time; it is the phase for it"],
  },
  follicular: {
    key: "follicular", name: "Follicular", tag: "Building",
    hormone: "Oestrogen climbs steadily as a follicle matures. Progesterone stays near zero.",
    body: ["Skin usually clears","Discharge moves from dry to sticky to creamy","Strength and stamina return"],
    feel: ["Energy and optimism build day by day","Focus and verbal fluency sharpen","Appetite is usually lower and steadier"],
    care: ["The best window for hard training and new projects","Sleep needs often drop slightly","Good time to schedule the things you have been putting off"],
  },
  fertile: {
    key: "fertile", name: "Fertile window", tag: "Peak",
    hormone: "Oestrogen peaks, LH surges, testosterone lifts. Ovulation follows the surge within a day or two.",
    body: ["Clear, stretchy egg-white discharge","A one-sided twinge for some people","Breasts may start to feel fuller","Body temperature ticks up just after ovulation"],
    feel: ["Usually the highest-energy, most social days of the month","Libido typically peaks","Some people get a short mood dip straight after ovulation as oestrogen drops"],
    care: ["Peak strength — a good week for personal bests","This is the only window where pregnancy is possible, roughly five days before to one day after ovulation","The timing here is an estimate, not a contraceptive method"],
  },
  luteal: {
    key: "luteal", name: "Luteal", tag: "Winding down",
    hormone: "Progesterone rises to its peak and oestrogen makes a smaller second rise.",
    body: ["Bloating and slower digestion","Breast tenderness","Slightly warmer, often thirstier","Appetite increases — that is hormonal, not a lapse"],
    feel: ["A calmer, more inward pull early in the phase","Sleep can get heavier but less refreshing","Focus starts to narrow"],
    care: ["Steady, moderate movement suits this phase better than intensity","Protect sleep — this is where debt builds up","Front-load demanding work into the first half of the phase"],
  },
  late: {
    key: "late", name: "Late luteal", tag: "PMS window",
    hormone: "Both oestrogen and progesterone fall away sharply. That withdrawal is what most PMS symptoms track.",
    body: ["Cramping may start before any bleeding","Skin breakouts","Fluid retention and heaviness","Headaches"],
    feel: ["Irritability, tearfulness and anxiety are most common here","Small things land harder — the feeling is real, the trigger often is not","Concentration is at its lowest point of the month"],
    care: ["Fewer commitments, if you have any say in the schedule","Light movement reliably takes the edge off","If these days are regularly unmanageable, that is worth raising with a clinician"],
  },
};
const PHASE_ORDER = ["menstrual","follicular","fertile","luteal","late"];

/* ================================ language ================================ *
 * LANG is set from settings on every render, the same way FMT is. t() falls
 * back to English for anything not yet translated, so the interface is never
 * left blank. User-entered and logged values (symptom names, notes) are never
 * translated — they are data, not chrome.
 * ------------------------------------------------------------------------ */
let LANG = "en";
const t = (k) => (DICT[LANG] && DICT[LANG][k]) || DICT.en[k] || k;

const DICT = {
  en: {
    moreToLog:"More to log", hormoneNoteShort:"Hormone levels are modelled from your cycle, not measured. Estimates only — not contraception.",
    versionHistory:"Version history", chNew:"New", chBetter:"Improved", chFix:"Fixed",
    changelogLead:"Every change, newest first.",
    today:"Today", calendar:"Calendar", log:"Log", insights:"Insights", you:"You",
    settings:"Settings", partnerView:"Partner view",
    cont:"Continue", skip:"Skip this", done:"Done", back:"Back", close:"Close",
    more:"More", less:"Less", edit:"Edit", remove:"Remove", notSure:"I'm not sure",
    dontRemember:"I don't remember", notNow:"Not now", off:"Off", showFewer:"Show fewer",
    cycleDay:"Cycle day", preview:"Preview", nothingLoggedYet:"Nothing logged yet",
    periodIn:"Period in", periodTomorrow:"Period expected tomorrow",
    periodToday:"Period expected today", periodLate:"Period is late by",
    expected:"Expected", dragDial:"drag the dial to look ahead",
    todaysHormones:"Today's hormones", howPhaseFeels:"How this phase tends to feel",
    yourPattern:"Your pattern", typicallyIn:"Typically in the",
    logTodayCard:"Log today", addMoodSymptoms:"Add mood, symptoms and a note",
    avgCycleLabel:"day average cycle", avgPeriodLabel:"day average period",
    assumedCycle:"day cycle, assumed", variationLabel:"day variation",
    notEnoughCycles:"not enough cycles yet",
    hormoneNote:"Hormone levels are modelled from your cycle timing, not measured. Predictions are estimates — not contraception, and not a substitute for medical advice.",
    learning:"Learning", gettingFeel:"Getting a feel", tunedToYou:"Tuned to you", wellTuned:"Well tuned",
    cycle:"cycle", cycles:"cycles", day:"day", days:"days", logged:"logged",
    phMenstrual:"Menstrual", phFollicular:"Follicular", phFertile:"Fertile window",
    phLuteal:"Luteal", phLate:"Late luteal", phase:"phase",
    tagBleeding:"Bleeding", tagBuilding:"Building", tagPeak:"Peak",
    tagWinding:"Winding down", tagPMS:"PMS window",
    month:"Month", year:"Year", loggedPeriod:"Logged period", predicted:"Predicted",
    fertileWindow:"Fertile window", ovulation:"Ovulation", notesSymptoms:"Notes or symptoms",
    tapDayHint:"Tap a day to see what's logged. Hold it to open the log.",
    tapMonthHint:"Tap a month to see its summary. Hold it to open the month.",
    nothingLogged:"Nothing logged.", editThisDay:"Edit this day", logThisDay:"Log this day",
    daysLogged:"Days logged", noPeriodLogged:"No period logged", periodWord:"Period",
    flow:"Flow", flowNone:"None", flowLight:"Light", flowMedium:"Medium", flowHeavy:"Heavy",
    clear:"Clear", symptoms:"Symptoms", mood:"Mood", skinHair:"Skin & hair", sexLife:"Sex life",
    cervicalMucus:"Cervical mucus", ovulationTest:"Ovulation test", pregnancyTest:"Pregnancy test",
    breastExam:"Breast self-exam", medicine:"Medicine", lifestyle:"Lifestyle", note:"Note",
    weight:"Weight", temperature:"Temperature", sleep:"Sleep", water:"Water", glasses:"glasses",
    notePlaceholder:"Anything worth remembering about this day",
    yourPatterns:"Your patterns", mostLogged:"Most logged", cycleHistory:"Cycle history",
    showOlder:"Show older cycles", daysBleeding:"of bleeding", dayCycleSuffix:"-day cycle",
    current:"current", noPeriodsYet:"No periods logged yet.",
    addYourName:"Add your name", noCycleYet:"No cycle yet", dayAverage:"-day average",
    yourProfile:"Your profile", periodCycle:"Period & cycle", hormonesPhases:"Hormones & phases",
    notes:"Notes", birthControl:"Birth control", pastLogs:"Past logs", dataPrivacy:"Data & privacy",
    exportWord:"Export", reminders:"Reminders", partner:"Partner", about:"About",
    cycleAnalysis:"Cycle analysis", partnerMode:"Partner mode",
    notifications:"Notifications", appSection:"App", yourData:"Your data", support:"Support",
    cycleReminders:"Cycle reminders", medicineReminders:"Medicine reminders",
    otherReminders:"Other reminders", language:"Language", themeWallpaper:"Theme & wallpaper",
    displayHide:"Display & hide", widgets:"Widgets", appleHealth:"Apple Health",
    exportReport:"Export report", importData:"Import data", reportBug:"Report a bug",
    sendFeedback:"Send feedback", rateApp:"Rate Celeste",
    setupTitle:"Let's set up your cycle", getStarted:"Get started", skipSetup:"Skip setup",
    followPartner:"I'm following a partner's cycle", chooseLanguage:"Choose your language",
    step:"Step", of:"of", finishSetup:"Finish setup",
    qLastPeriod:"When did your last period start?",
    qCycleLength:"How long is your cycle?",
    qPeriodLength:"How many days does it last?",
    qGoal:"What brought you here?",
    qNotif:"What should Celeste tell you about?",
    qShare:"Share with a partner?",
    pickDate:"Pick a date", aWeekAgo:"A week ago", twoWeeksAgo:"Two weeks ago",
  },
};

DICT.pt = {
  moreToLog:"Mais para registar", hormoneNoteShort:"Os níveis hormonais são estimados a partir do teu ciclo, não medidos. Apenas estimativas — não são contraceção.",
  versionHistory:"Histórico de versões", chNew:"Novo", chBetter:"Melhorado", chFix:"Corrigido",
  changelogLead:"Todas as alterações, da mais recente.",
  today:"Hoje", calendar:"Calendário", log:"Registar", insights:"Análise", you:"Tu",
  settings:"Definições", partnerView:"Vista do parceiro",
  cont:"Continuar", skip:"Ignorar", done:"Concluído", back:"Voltar", close:"Fechar",
  more:"Mais", less:"Menos", edit:"Editar", remove:"Remover", notSure:"Não tenho a certeza",
  dontRemember:"Não me lembro", notNow:"Agora não", off:"Desligado", showFewer:"Mostrar menos",
  cycleDay:"Dia do ciclo", preview:"Pré-visualização", nothingLoggedYet:"Ainda sem registos",
  periodIn:"Menstruação em", periodTomorrow:"Menstruação prevista para amanhã",
  periodToday:"Menstruação prevista para hoje", periodLate:"Menstruação atrasada",
  expected:"Prevista", dragDial:"arrasta o círculo para ver adiante",
  todaysHormones:"As tuas hormonas hoje", howPhaseFeels:"Como esta fase costuma sentir-se",
  yourPattern:"O teu padrão", typicallyIn:"Normalmente na fase",
  logTodayCard:"Registar hoje", addMoodSymptoms:"Adiciona humor, sintomas e uma nota",
  avgCycleLabel:"dias de ciclo médio", avgPeriodLabel:"dias de menstruação média",
  assumedCycle:"dias de ciclo, estimado", variationLabel:"dias de variação",
  notEnoughCycles:"ainda faltam ciclos",
  hormoneNote:"Os níveis hormonais são estimados a partir do teu ciclo, não medidos. As previsões são estimativas — não são contraceção nem substituem aconselhamento médico.",
  learning:"A aprender", gettingFeel:"A ganhar forma", tunedToYou:"Ajustado a ti", wellTuned:"Bem ajustado",
  cycle:"ciclo", cycles:"ciclos", day:"dia", days:"dias", logged:"registados",
  phMenstrual:"Menstrual", phFollicular:"Folicular", phFertile:"Janela fértil",
  phLuteal:"Lútea", phLate:"Lútea tardia", phase:"fase",
  tagBleeding:"Fluxo", tagBuilding:"A crescer", tagPeak:"Pico",
  tagWinding:"A descer", tagPMS:"Janela pré-menstrual",
  month:"Mês", year:"Ano", loggedPeriod:"Menstruação registada", predicted:"Prevista",
  fertileWindow:"Janela fértil", ovulation:"Ovulação", notesSymptoms:"Notas ou sintomas",
  tapDayHint:"Toca num dia para ver o que registaste. Mantém premido para abrir o registo.",
  tapMonthHint:"Toca num mês para ver o resumo. Mantém premido para o abrir.",
  nothingLogged:"Nada registado.", editThisDay:"Editar este dia", logThisDay:"Registar este dia",
  daysLogged:"Dias registados", noPeriodLogged:"Sem menstruação registada", periodWord:"Menstruação",
  flow:"Fluxo", flowNone:"Nenhum", flowLight:"Leve", flowMedium:"Médio", flowHeavy:"Intenso",
  clear:"Limpar", symptoms:"Sintomas", mood:"Humor", skinHair:"Pele e cabelo", sexLife:"Vida sexual",
  cervicalMucus:"Muco cervical", ovulationTest:"Teste de ovulação", pregnancyTest:"Teste de gravidez",
  breastExam:"Autoexame da mama", medicine:"Medicação", lifestyle:"Hábitos", note:"Nota",
  weight:"Peso", temperature:"Temperatura", sleep:"Sono", water:"Água", glasses:"copos",
  notePlaceholder:"Algo que queiras lembrar deste dia",
  yourPatterns:"Os teus padrões", mostLogged:"Mais registados", cycleHistory:"Histórico de ciclos",
  showOlder:"Ver ciclos anteriores", daysBleeding:"de fluxo", dayCycleSuffix:" dias de ciclo",
  current:"atual", noPeriodsYet:"Ainda sem menstruações registadas.",
  addYourName:"Adiciona o teu nome", noCycleYet:"Ainda sem ciclo", dayAverage:" dias em média",
  yourProfile:"O teu perfil", periodCycle:"Menstruação e ciclo", hormonesPhases:"Hormonas e fases",
  notes:"Notas", birthControl:"Contraceção", pastLogs:"Registos anteriores", dataPrivacy:"Dados e privacidade",
  exportWord:"Exportar", reminders:"Lembretes", partner:"Parceiro", about:"Sobre",
  cycleAnalysis:"Análise do ciclo", partnerMode:"Modo parceiro",
  notifications:"Notificações", appSection:"Aplicação", yourData:"Os teus dados", support:"Apoio",
  cycleReminders:"Lembretes do ciclo", medicineReminders:"Lembretes de medicação",
  otherReminders:"Outros lembretes", language:"Idioma", themeWallpaper:"Tema e fundo",
  displayHide:"Mostrar e ocultar", widgets:"Widgets", appleHealth:"Apple Saúde",
  exportReport:"Exportar relatório", importData:"Importar dados", reportBug:"Reportar um erro",
  sendFeedback:"Enviar comentários", rateApp:"Avaliar o Celeste",
  setupTitle:"Vamos configurar o teu ciclo", getStarted:"Começar", skipSetup:"Ignorar configuração",
  followPartner:"Estou a seguir o ciclo da minha parceira", chooseLanguage:"Escolhe o teu idioma",
  step:"Passo", of:"de", finishSetup:"Concluir",
  qLastPeriod:"Quando começou a tua última menstruação?",
  qCycleLength:"Quanto dura o teu ciclo?",
  qPeriodLength:"Quantos dias dura?",
  qGoal:"O que te traz aqui?",
  qNotif:"Sobre o que deve o Celeste avisar-te?",
  qShare:"Partilhar com o teu parceiro?",
  pickDate:"Escolhe uma data", aWeekAgo:"Há uma semana", twoWeeksAgo:"Há duas semanas",
};

DICT.nl = {
  moreToLog:"Meer bijhouden", hormoneNoteShort:"Hormoonwaarden worden berekend uit je cyclus, niet gemeten. Alleen schattingen — geen anticonceptie.",
  versionHistory:"Versiegeschiedenis", chNew:"Nieuw", chBetter:"Verbeterd", chFix:"Opgelost",
  changelogLead:"Alle wijzigingen, nieuwste eerst.",
  today:"Vandaag", calendar:"Kalender", log:"Bijhouden", insights:"Inzichten", you:"Jij",
  settings:"Instellingen", partnerView:"Partnerweergave",
  cont:"Doorgaan", skip:"Overslaan", done:"Klaar", back:"Terug", close:"Sluiten",
  more:"Meer", less:"Minder", edit:"Bewerken", remove:"Verwijderen", notSure:"Ik weet het niet zeker",
  dontRemember:"Weet ik niet meer", notNow:"Nu niet", off:"Uit", showFewer:"Toon minder",
  cycleDay:"Cyclusdag", preview:"Voorbeeld", nothingLoggedYet:"Nog niets bijgehouden",
  periodIn:"Menstruatie over", periodTomorrow:"Menstruatie morgen verwacht",
  periodToday:"Menstruatie vandaag verwacht", periodLate:"Menstruatie te laat met",
  expected:"Verwacht", dragDial:"sleep de cirkel om vooruit te kijken",
  todaysHormones:"Je hormonen vandaag", howPhaseFeels:"Hoe deze fase meestal voelt",
  yourPattern:"Jouw patroon", typicallyIn:"Meestal in de",
  logTodayCard:"Vandaag bijhouden", addMoodSymptoms:"Voeg stemming, symptomen en een notitie toe",
  avgCycleLabel:"dagen gemiddelde cyclus", avgPeriodLabel:"dagen gemiddelde menstruatie",
  assumedCycle:"dagen cyclus, aangenomen", variationLabel:"dagen variatie",
  notEnoughCycles:"nog te weinig cycli",
  hormoneNote:"Hormoonwaarden worden berekend uit je cyclus, niet gemeten. Voorspellingen zijn schattingen — geen anticonceptie en geen vervanging van medisch advies.",
  learning:"Leert nog", gettingFeel:"Krijgt vorm", tunedToYou:"Op jou afgestemd", wellTuned:"Goed afgestemd",
  cycle:"cyclus", cycles:"cycli", day:"dag", days:"dagen", logged:"bijgehouden",
  phMenstrual:"Menstruatie", phFollicular:"Folliculair", phFertile:"Vruchtbare periode",
  phLuteal:"Luteaal", phLate:"Late luteale fase", phase:"fase",
  tagBleeding:"Bloeding", tagBuilding:"Opbouw", tagPeak:"Piek",
  tagWinding:"Afbouw", tagPMS:"PMS-periode",
  month:"Maand", year:"Jaar", loggedPeriod:"Bijgehouden menstruatie", predicted:"Voorspeld",
  fertileWindow:"Vruchtbare periode", ovulation:"Eisprong", notesSymptoms:"Notities of symptomen",
  tapDayHint:"Tik op een dag om te zien wat je hebt bijgehouden. Houd ingedrukt om te bewerken.",
  tapMonthHint:"Tik op een maand voor het overzicht. Houd ingedrukt om te openen.",
  nothingLogged:"Niets bijgehouden.", editThisDay:"Deze dag bewerken", logThisDay:"Deze dag bijhouden",
  daysLogged:"Bijgehouden dagen", noPeriodLogged:"Geen menstruatie bijgehouden", periodWord:"Menstruatie",
  flow:"Bloeding", flowNone:"Geen", flowLight:"Licht", flowMedium:"Gemiddeld", flowHeavy:"Hevig",
  clear:"Wissen", symptoms:"Symptomen", mood:"Stemming", skinHair:"Huid en haar", sexLife:"Seksleven",
  cervicalMucus:"Baarmoederhalsslijm", ovulationTest:"Ovulatietest", pregnancyTest:"Zwangerschapstest",
  breastExam:"Borstzelfonderzoek", medicine:"Medicatie", lifestyle:"Leefstijl", note:"Notitie",
  weight:"Gewicht", temperature:"Temperatuur", sleep:"Slaap", water:"Water", glasses:"glazen",
  notePlaceholder:"Iets wat je over deze dag wilt onthouden",
  yourPatterns:"Jouw patronen", mostLogged:"Meest bijgehouden", cycleHistory:"Cyclusgeschiedenis",
  showOlder:"Toon oudere cycli", daysBleeding:"bloeding", dayCycleSuffix:"-daagse cyclus",
  current:"lopend", noPeriodsYet:"Nog geen menstruatie bijgehouden.",
  addYourName:"Voeg je naam toe", noCycleYet:"Nog geen cyclus", dayAverage:" dagen gemiddeld",
  yourProfile:"Jouw profiel", periodCycle:"Menstruatie en cyclus", hormonesPhases:"Hormonen en fasen",
  notes:"Notities", birthControl:"Anticonceptie", pastLogs:"Eerdere registraties", dataPrivacy:"Gegevens en privacy",
  exportWord:"Exporteren", reminders:"Herinneringen", partner:"Partner", about:"Over",
  cycleAnalysis:"Cyclusanalyse", partnerMode:"Partnermodus",
  notifications:"Meldingen", appSection:"App", yourData:"Jouw gegevens", support:"Hulp",
  cycleReminders:"Cyclusherinneringen", medicineReminders:"Medicatieherinneringen",
  otherReminders:"Overige herinneringen", language:"Taal", themeWallpaper:"Thema en achtergrond",
  displayHide:"Tonen en verbergen", widgets:"Widgets", appleHealth:"Apple Health",
  exportReport:"Rapport exporteren", importData:"Gegevens importeren", reportBug:"Fout melden",
  sendFeedback:"Feedback sturen", rateApp:"Celeste beoordelen",
  setupTitle:"Laten we je cyclus instellen", getStarted:"Beginnen", skipSetup:"Instellen overslaan",
  followPartner:"Ik volg de cyclus van mijn partner", chooseLanguage:"Kies je taal",
  step:"Stap", of:"van", finishSetup:"Afronden",
  qLastPeriod:"Wanneer begon je laatste menstruatie?",
  qCycleLength:"Hoe lang is je cyclus?",
  qPeriodLength:"Hoeveel dagen duurt hij?",
  qGoal:"Wat brengt je hier?",
  qNotif:"Waarover moet Celeste je iets laten weten?",
  qShare:"Delen met een partner?",
  pickDate:"Kies een datum", aWeekAgo:"Een week geleden", twoWeeksAgo:"Twee weken geleden",
};

DICT.pl = {
  moreToLog:"Więcej do zapisania", hormoneNoteShort:"Poziomy hormonów są szacowane z cyklu, nie mierzone. To tylko szacunki — nie antykoncepcja.",
  versionHistory:"Historia wersji", chNew:"Nowe", chBetter:"Ulepszone", chFix:"Naprawione",
  changelogLead:"Wszystkie zmiany, od najnowszych.",
  today:"Dziś", calendar:"Kalendarz", log:"Zapisz", insights:"Analiza", you:"Ty",
  settings:"Ustawienia", partnerView:"Widok partnera",
  cont:"Dalej", skip:"Pomiń", done:"Gotowe", back:"Wstecz", close:"Zamknij",
  more:"Więcej", less:"Mniej", edit:"Edytuj", remove:"Usuń", notSure:"Nie jestem pewna",
  dontRemember:"Nie pamiętam", notNow:"Nie teraz", off:"Wyłączone", showFewer:"Pokaż mniej",
  cycleDay:"Dzień cyklu", preview:"Podgląd", nothingLoggedYet:"Nic jeszcze nie zapisano",
  periodIn:"Miesiączka za", periodTomorrow:"Miesiączka spodziewana jutro",
  periodToday:"Miesiączka spodziewana dziś", periodLate:"Miesiączka spóźniona o",
  expected:"Spodziewana", dragDial:"przeciągnij tarczę, aby zobaczyć dalej",
  todaysHormones:"Twoje hormony dziś", howPhaseFeels:"Jak zwykle przebiega ta faza",
  yourPattern:"Twój wzorzec", typicallyIn:"Zazwyczaj w fazie",
  logTodayCard:"Zapisz dzisiaj", addMoodSymptoms:"Dodaj nastrój, objawy i notatkę",
  avgCycleLabel:"dni średniego cyklu", avgPeriodLabel:"dni średniej miesiączki",
  assumedCycle:"dni cyklu, przyjęte", variationLabel:"dni wahania",
  notEnoughCycles:"za mało cykli",
  hormoneNote:"Poziomy hormonów są szacowane na podstawie cyklu, nie mierzone. Prognozy są szacunkami — nie zastępują antykoncepcji ani porady lekarskiej.",
  learning:"Uczy się", gettingFeel:"Nabiera kształtu", tunedToYou:"Dopasowane do Ciebie", wellTuned:"Dobrze dopasowane",
  cycle:"cykl", cycles:"cykli", day:"dzień", days:"dni", logged:"zapisanych",
  phMenstrual:"Miesiączkowa", phFollicular:"Folikularna", phFertile:"Okno płodne",
  phLuteal:"Lutealna", phLate:"Późna lutealna", phase:"faza",
  tagBleeding:"Krwawienie", tagBuilding:"Wzrost", tagPeak:"Szczyt",
  tagWinding:"Spadek", tagPMS:"Okres PMS",
  month:"Miesiąc", year:"Rok", loggedPeriod:"Zapisana miesiączka", predicted:"Prognoza",
  fertileWindow:"Okno płodne", ovulation:"Owulacja", notesSymptoms:"Notatki lub objawy",
  tapDayHint:"Dotknij dnia, aby zobaczyć zapisy. Przytrzymaj, aby otworzyć edycję.",
  tapMonthHint:"Dotknij miesiąca, aby zobaczyć podsumowanie. Przytrzymaj, aby otworzyć.",
  nothingLogged:"Nic nie zapisano.", editThisDay:"Edytuj ten dzień", logThisDay:"Zapisz ten dzień",
  daysLogged:"Zapisane dni", noPeriodLogged:"Brak zapisanej miesiączki", periodWord:"Miesiączka",
  flow:"Krwawienie", flowNone:"Brak", flowLight:"Lekkie", flowMedium:"Średnie", flowHeavy:"Obfite",
  clear:"Wyczyść", symptoms:"Objawy", mood:"Nastrój", skinHair:"Skóra i włosy", sexLife:"Życie seksualne",
  cervicalMucus:"Śluz szyjkowy", ovulationTest:"Test owulacyjny", pregnancyTest:"Test ciążowy",
  breastExam:"Samobadanie piersi", medicine:"Leki", lifestyle:"Styl życia", note:"Notatka",
  weight:"Waga", temperature:"Temperatura", sleep:"Sen", water:"Woda", glasses:"szklanek",
  notePlaceholder:"Coś, co warto zapamiętać z tego dnia",
  yourPatterns:"Twoje wzorce", mostLogged:"Najczęściej zapisywane", cycleHistory:"Historia cykli",
  showOlder:"Pokaż starsze cykle", daysBleeding:"krwawienia", dayCycleSuffix:"-dniowy cykl",
  current:"trwający", noPeriodsYet:"Brak zapisanych miesiączek.",
  addYourName:"Dodaj swoje imię", noCycleYet:"Brak cyklu", dayAverage:" dni średnio",
  yourProfile:"Twój profil", periodCycle:"Miesiączka i cykl", hormonesPhases:"Hormony i fazy",
  notes:"Notatki", birthControl:"Antykoncepcja", pastLogs:"Wcześniejsze zapisy", dataPrivacy:"Dane i prywatność",
  exportWord:"Eksport", reminders:"Przypomnienia", partner:"Partner", about:"O aplikacji",
  cycleAnalysis:"Analiza cyklu", partnerMode:"Tryb partnera",
  notifications:"Powiadomienia", appSection:"Aplikacja", yourData:"Twoje dane", support:"Pomoc",
  cycleReminders:"Przypomnienia o cyklu", medicineReminders:"Przypomnienia o lekach",
  otherReminders:"Inne przypomnienia", language:"Język", themeWallpaper:"Motyw i tapeta",
  displayHide:"Pokaż i ukryj", widgets:"Widżety", appleHealth:"Apple Health",
  exportReport:"Eksportuj raport", importData:"Importuj dane", reportBug:"Zgłoś błąd",
  sendFeedback:"Wyślij opinię", rateApp:"Oceń Celeste",
  setupTitle:"Skonfigurujmy Twój cykl", getStarted:"Zaczynajmy", skipSetup:"Pomiń konfigurację",
  followPartner:"Śledzę cykl partnerki", chooseLanguage:"Wybierz język",
  step:"Krok", of:"z", finishSetup:"Zakończ",
  qLastPeriod:"Kiedy zaczęła się ostatnia miesiączka?",
  qCycleLength:"Ile trwa Twój cykl?",
  qPeriodLength:"Ile dni trwa miesiączka?",
  qGoal:"Co Cię tu sprowadza?",
  qNotif:"O czym Celeste ma Ci przypominać?",
  qShare:"Udostępnić partnerowi?",
  pickDate:"Wybierz datę", aWeekAgo:"Tydzień temu", twoWeeksAgo:"Dwa tygodnie temu",
};

DICT.ru = {
  moreToLog:"Записать ещё", hormoneNoteShort:"Уровни гормонов рассчитаны по циклу, а не измерены. Только оценки — это не контрацепция.",
  versionHistory:"История версий", chNew:"Новое", chBetter:"Улучшено", chFix:"Исправлено",
  changelogLead:"Все изменения, начиная с последних.",
  today:"Сегодня", calendar:"Календарь", log:"Запись", insights:"Аналитика", you:"Профиль",
  settings:"Настройки", partnerView:"Режим партнёра",
  cont:"Далее", skip:"Пропустить", done:"Готово", back:"Назад", close:"Закрыть",
  more:"Ещё", less:"Свернуть", edit:"Изменить", remove:"Удалить", notSure:"Не уверена",
  dontRemember:"Не помню", notNow:"Не сейчас", off:"Выкл.", showFewer:"Показать меньше",
  cycleDay:"День цикла", preview:"Просмотр", nothingLoggedYet:"Пока ничего не записано",
  periodIn:"Месячные через", periodTomorrow:"Месячные ожидаются завтра",
  periodToday:"Месячные ожидаются сегодня", periodLate:"Задержка",
  expected:"Ожидаются", dragDial:"потяните круг, чтобы посмотреть вперёд",
  todaysHormones:"Ваши гормоны сегодня", howPhaseFeels:"Как обычно проходит эта фаза",
  yourPattern:"Ваша закономерность", typicallyIn:"Обычно в фазе",
  logTodayCard:"Записать сегодня", addMoodSymptoms:"Добавьте настроение, симптомы и заметку",
  avgCycleLabel:"дней средний цикл", avgPeriodLabel:"дней средние месячные",
  assumedCycle:"дней цикла, принято", variationLabel:"дней разброса",
  notEnoughCycles:"пока мало циклов",
  hormoneNote:"Уровни гормонов рассчитаны по вашему циклу, а не измерены. Прогнозы приблизительны — это не контрацепция и не замена врачу.",
  learning:"Учится", gettingFeel:"Набирает форму", tunedToYou:"Настроено под вас", wellTuned:"Хорошо настроено",
  cycle:"цикл", cycles:"циклов", day:"день", days:"дней", logged:"записано",
  phMenstrual:"Менструальная", phFollicular:"Фолликулярная", phFertile:"Фертильное окно",
  phLuteal:"Лютеиновая", phLate:"Поздняя лютеиновая", phase:"фаза",
  tagBleeding:"Кровотечение", tagBuilding:"Рост", tagPeak:"Пик",
  tagWinding:"Спад", tagPMS:"Период ПМС",
  month:"Месяц", year:"Год", loggedPeriod:"Записанные месячные", predicted:"Прогноз",
  fertileWindow:"Фертильное окно", ovulation:"Овуляция", notesSymptoms:"Заметки или симптомы",
  tapDayHint:"Нажмите на день, чтобы увидеть записи. Удерживайте, чтобы открыть запись.",
  tapMonthHint:"Нажмите на месяц для сводки. Удерживайте, чтобы открыть.",
  nothingLogged:"Ничего не записано.", editThisDay:"Изменить этот день", logThisDay:"Записать этот день",
  daysLogged:"Дней записано", noPeriodLogged:"Месячные не записаны", periodWord:"Месячные",
  flow:"Выделения", flowNone:"Нет", flowLight:"Слабые", flowMedium:"Умеренные", flowHeavy:"Обильные",
  clear:"Очистить", symptoms:"Симптомы", mood:"Настроение", skinHair:"Кожа и волосы", sexLife:"Половая жизнь",
  cervicalMucus:"Цервикальная слизь", ovulationTest:"Тест на овуляцию", pregnancyTest:"Тест на беременность",
  breastExam:"Самообследование груди", medicine:"Лекарства", lifestyle:"Образ жизни", note:"Заметка",
  weight:"Вес", temperature:"Температура", sleep:"Сон", water:"Вода", glasses:"стаканов",
  notePlaceholder:"Что стоит запомнить об этом дне",
  yourPatterns:"Ваши закономерности", mostLogged:"Чаще всего", cycleHistory:"История циклов",
  showOlder:"Показать прошлые циклы", daysBleeding:"кровотечения", dayCycleSuffix:"-дневный цикл",
  current:"текущий", noPeriodsYet:"Месячные пока не записаны.",
  addYourName:"Добавьте имя", noCycleYet:"Цикла пока нет", dayAverage:" дней в среднем",
  yourProfile:"Ваш профиль", periodCycle:"Месячные и цикл", hormonesPhases:"Гормоны и фазы",
  notes:"Заметки", birthControl:"Контрацепция", pastLogs:"Прошлые записи", dataPrivacy:"Данные и приватность",
  exportWord:"Экспорт", reminders:"Напоминания", partner:"Партнёр", about:"О приложении",
  cycleAnalysis:"Анализ цикла", partnerMode:"Режим партнёра",
  notifications:"Уведомления", appSection:"Приложение", yourData:"Ваши данные", support:"Поддержка",
  cycleReminders:"Напоминания о цикле", medicineReminders:"Напоминания о лекарствах",
  otherReminders:"Другие напоминания", language:"Язык", themeWallpaper:"Тема и фон",
  displayHide:"Показать и скрыть", widgets:"Виджеты", appleHealth:"Apple Health",
  exportReport:"Экспорт отчёта", importData:"Импорт данных", reportBug:"Сообщить об ошибке",
  sendFeedback:"Отправить отзыв", rateApp:"Оценить Celeste",
  setupTitle:"Настроим ваш цикл", getStarted:"Начать", skipSetup:"Пропустить настройку",
  followPartner:"Я слежу за циклом партнёрши", chooseLanguage:"Выберите язык",
  step:"Шаг", of:"из", finishSetup:"Завершить",
  qLastPeriod:"Когда начались последние месячные?",
  qCycleLength:"Какой длины ваш цикл?",
  qPeriodLength:"Сколько дней они длятся?",
  qGoal:"Что вас сюда привело?",
  qNotif:"О чём Celeste должен напоминать?",
  qShare:"Поделиться с партнёром?",
  pickDate:"Выберите дату", aWeekAgo:"Неделю назад", twoWeeksAgo:"Две недели назад",
};

DICT.tr = {
  moreToLog:"Daha fazlasını kaydet", hormoneNoteShort:"Hormon düzeyleri döngünden hesaplanır, ölçülmez. Yalnızca tahmin — doğum kontrolü değildir.",
  versionHistory:"Sürüm geçmişi", chNew:"Yeni", chBetter:"İyileştirildi", chFix:"Düzeltildi",
  changelogLead:"Tüm değişiklikler, en yeniden başlayarak.",
  today:"Bugün", calendar:"Takvim", log:"Kaydet", insights:"İçgörüler", you:"Sen",
  settings:"Ayarlar", partnerView:"Partner görünümü",
  cont:"Devam", skip:"Atla", done:"Bitti", back:"Geri", close:"Kapat",
  more:"Daha fazla", less:"Daha az", edit:"Düzenle", remove:"Kaldır", notSure:"Emin değilim",
  dontRemember:"Hatırlamıyorum", notNow:"Şimdi değil", off:"Kapalı", showFewer:"Daha az göster",
  cycleDay:"Döngü günü", preview:"Önizleme", nothingLoggedYet:"Henüz kayıt yok",
  periodIn:"Regl", periodTomorrow:"Regl yarın bekleniyor",
  periodToday:"Regl bugün bekleniyor", periodLate:"Regl gecikti",
  expected:"Beklenen", dragDial:"ileriye bakmak için çemberi kaydır",
  todaysHormones:"Bugünkü hormonların", howPhaseFeels:"Bu evre genelde nasıl hissettirir",
  yourPattern:"Senin örüntün", typicallyIn:"Genellikle",
  logTodayCard:"Bugünü kaydet", addMoodSymptoms:"Ruh hâli, belirti ve not ekle",
  avgCycleLabel:"gün ortalama döngü", avgPeriodLabel:"gün ortalama regl",
  assumedCycle:"gün döngü, varsayılan", variationLabel:"gün değişkenlik",
  notEnoughCycles:"henüz yeterli döngü yok",
  hormoneNote:"Hormon düzeyleri döngünden hesaplanır, ölçülmez. Tahminler yaklaşıktır — doğum kontrolü değildir ve tıbbi tavsiyenin yerini tutmaz.",
  learning:"Öğreniyor", gettingFeel:"Şekilleniyor", tunedToYou:"Sana göre ayarlı", wellTuned:"İyi ayarlanmış",
  cycle:"döngü", cycles:"döngü", day:"gün", days:"gün", logged:"kayıt",
  phMenstrual:"Adet", phFollicular:"Foliküler", phFertile:"Doğurgan dönem",
  phLuteal:"Luteal", phLate:"Geç luteal", phase:"evre",
  tagBleeding:"Kanama", tagBuilding:"Yükseliş", tagPeak:"Zirve",
  tagWinding:"Azalış", tagPMS:"PMS dönemi",
  month:"Ay", year:"Yıl", loggedPeriod:"Kaydedilen regl", predicted:"Tahmini",
  fertileWindow:"Doğurgan dönem", ovulation:"Yumurtlama", notesSymptoms:"Not veya belirti",
  tapDayHint:"Kayıtları görmek için bir güne dokun. Kayıt açmak için basılı tut.",
  tapMonthHint:"Özet için bir aya dokun. Açmak için basılı tut.",
  nothingLogged:"Kayıt yok.", editThisDay:"Bu günü düzenle", logThisDay:"Bu günü kaydet",
  daysLogged:"Kayıtlı gün", noPeriodLogged:"Regl kaydı yok", periodWord:"Regl",
  flow:"Kanama", flowNone:"Yok", flowLight:"Hafif", flowMedium:"Orta", flowHeavy:"Yoğun",
  clear:"Temizle", symptoms:"Belirtiler", mood:"Ruh hâli", skinHair:"Cilt ve saç", sexLife:"Cinsel yaşam",
  cervicalMucus:"Rahim ağzı akıntısı", ovulationTest:"Ovülasyon testi", pregnancyTest:"Gebelik testi",
  breastExam:"Meme kendi kendine muayene", medicine:"İlaç", lifestyle:"Yaşam", note:"Not",
  weight:"Kilo", temperature:"Sıcaklık", sleep:"Uyku", water:"Su", glasses:"bardak",
  notePlaceholder:"Bu günle ilgili hatırlamak istediğin bir şey",
  yourPatterns:"Örüntülerin", mostLogged:"En çok kaydedilen", cycleHistory:"Döngü geçmişi",
  showOlder:"Eski döngüleri göster", daysBleeding:"kanama", dayCycleSuffix:" günlük döngü",
  current:"devam ediyor", noPeriodsYet:"Henüz regl kaydı yok.",
  addYourName:"Adını ekle", noCycleYet:"Henüz döngü yok", dayAverage:" gün ortalama",
  yourProfile:"Profilin", periodCycle:"Regl ve döngü", hormonesPhases:"Hormonlar ve evreler",
  notes:"Notlar", birthControl:"Doğum kontrolü", pastLogs:"Geçmiş kayıtlar", dataPrivacy:"Veri ve gizlilik",
  exportWord:"Dışa aktar", reminders:"Hatırlatıcılar", partner:"Partner", about:"Hakkında",
  cycleAnalysis:"Döngü analizi", partnerMode:"Partner modu",
  notifications:"Bildirimler", appSection:"Uygulama", yourData:"Verilerin", support:"Destek",
  cycleReminders:"Döngü hatırlatıcıları", medicineReminders:"İlaç hatırlatıcıları",
  otherReminders:"Diğer hatırlatıcılar", language:"Dil", themeWallpaper:"Tema ve duvar kâğıdı",
  displayHide:"Göster ve gizle", widgets:"Widget'lar", appleHealth:"Apple Health",
  exportReport:"Rapor dışa aktar", importData:"Veri içe aktar", reportBug:"Hata bildir",
  sendFeedback:"Geri bildirim gönder", rateApp:"Celeste'i değerlendir",
  setupTitle:"Döngünü ayarlayalım", getStarted:"Başla", skipSetup:"Kurulumu atla",
  followPartner:"Partnerimin döngüsünü takip ediyorum", chooseLanguage:"Dilini seç",
  step:"Adım", of:"/", finishSetup:"Kurulumu bitir",
  qLastPeriod:"Son reglin ne zaman başladı?",
  qCycleLength:"Döngün ne kadar sürüyor?",
  qPeriodLength:"Kaç gün sürüyor?",
  qGoal:"Seni buraya ne getirdi?",
  qNotif:"Celeste sana neleri hatırlatsın?",
  qShare:"Partnerinle paylaşmak ister misin?",
  pickDate:"Tarih seç", aWeekAgo:"Bir hafta önce", twoWeeksAgo:"İki hafta önce",
};

DICT.ro = {
  moreToLog:"Mai multe de înregistrat", hormoneNoteShort:"Nivelurile hormonale sunt estimate din ciclu, nu măsurate. Doar estimări — nu sunt contracepție.",
  versionHistory:"Istoricul versiunilor", chNew:"Nou", chBetter:"Îmbunătățit", chFix:"Reparat",
  changelogLead:"Toate modificările, cele mai recente primele.",
  today:"Azi", calendar:"Calendar", log:"Înregistrează", insights:"Analize", you:"Tu",
  settings:"Setări", partnerView:"Vizualizare partener",
  cont:"Continuă", skip:"Omite", done:"Gata", back:"Înapoi", close:"Închide",
  more:"Mai mult", less:"Mai puțin", edit:"Editează", remove:"Elimină", notSure:"Nu sunt sigură",
  dontRemember:"Nu îmi amintesc", notNow:"Nu acum", off:"Oprit", showFewer:"Arată mai puține",
  cycleDay:"Ziua ciclului", preview:"Previzualizare", nothingLoggedYet:"Nimic înregistrat încă",
  periodIn:"Menstruație peste", periodTomorrow:"Menstruație așteptată mâine",
  periodToday:"Menstruație așteptată azi", periodLate:"Menstruație întârziată cu",
  expected:"Așteptată", dragDial:"trage cercul pentru a privi înainte",
  todaysHormones:"Hormonii tăi azi", howPhaseFeels:"Cum se simte de obicei această fază",
  yourPattern:"Tiparul tău", typicallyIn:"De obicei în faza",
  logTodayCard:"Înregistrează azi", addMoodSymptoms:"Adaugă dispoziție, simptome și o notiță",
  avgCycleLabel:"zile ciclu mediu", avgPeriodLabel:"zile menstruație medie",
  assumedCycle:"zile ciclu, estimat", variationLabel:"zile variație",
  notEnoughCycles:"încă prea puține cicluri",
  hormoneNote:"Nivelurile hormonale sunt estimate din ciclul tău, nu măsurate. Predicțiile sunt aproximări — nu sunt contracepție și nu înlocuiesc sfatul medical.",
  learning:"Învață", gettingFeel:"Prinde contur", tunedToYou:"Ajustat pentru tine", wellTuned:"Bine ajustat",
  cycle:"ciclu", cycles:"cicluri", day:"zi", days:"zile", logged:"înregistrate",
  phMenstrual:"Menstruală", phFollicular:"Foliculară", phFertile:"Fereastră fertilă",
  phLuteal:"Luteală", phLate:"Luteală târzie", phase:"faza",
  tagBleeding:"Sângerare", tagBuilding:"În creștere", tagPeak:"Vârf",
  tagWinding:"În scădere", tagPMS:"Perioada PMS",
  month:"Lună", year:"An", loggedPeriod:"Menstruație înregistrată", predicted:"Estimată",
  fertileWindow:"Fereastră fertilă", ovulation:"Ovulație", notesSymptoms:"Notițe sau simptome",
  tapDayHint:"Atinge o zi pentru a vedea înregistrările. Ține apăsat pentru a edita.",
  tapMonthHint:"Atinge o lună pentru rezumat. Ține apăsat pentru a o deschide.",
  nothingLogged:"Nimic înregistrat.", editThisDay:"Editează această zi", logThisDay:"Înregistrează această zi",
  daysLogged:"Zile înregistrate", noPeriodLogged:"Nicio menstruație înregistrată", periodWord:"Menstruație",
  flow:"Flux", flowNone:"Niciunul", flowLight:"Ușor", flowMedium:"Mediu", flowHeavy:"Abundent",
  clear:"Șterge", symptoms:"Simptome", mood:"Dispoziție", skinHair:"Piele și păr", sexLife:"Viață sexuală",
  cervicalMucus:"Mucus cervical", ovulationTest:"Test de ovulație", pregnancyTest:"Test de sarcină",
  breastExam:"Autoexaminarea sânilor", medicine:"Medicamente", lifestyle:"Stil de viață", note:"Notiță",
  weight:"Greutate", temperature:"Temperatură", sleep:"Somn", water:"Apă", glasses:"pahare",
  notePlaceholder:"Ceva de reținut despre această zi",
  yourPatterns:"Tiparele tale", mostLogged:"Cel mai des", cycleHistory:"Istoricul ciclurilor",
  showOlder:"Arată ciclurile anterioare", daysBleeding:"de sângerare", dayCycleSuffix:" zile ciclu",
  current:"în curs", noPeriodsYet:"Nicio menstruație înregistrată încă.",
  addYourName:"Adaugă-ți numele", noCycleYet:"Niciun ciclu încă", dayAverage:" zile în medie",
  yourProfile:"Profilul tău", periodCycle:"Menstruație și ciclu", hormonesPhases:"Hormoni și faze",
  notes:"Notițe", birthControl:"Contracepție", pastLogs:"Înregistrări anterioare", dataPrivacy:"Date și confidențialitate",
  exportWord:"Exportă", reminders:"Mementouri", partner:"Partener", about:"Despre",
  cycleAnalysis:"Analiza ciclului", partnerMode:"Mod partener",
  notifications:"Notificări", appSection:"Aplicație", yourData:"Datele tale", support:"Asistență",
  cycleReminders:"Mementouri pentru ciclu", medicineReminders:"Mementouri pentru medicamente",
  otherReminders:"Alte mementouri", language:"Limbă", themeWallpaper:"Temă și fundal",
  displayHide:"Afișează și ascunde", widgets:"Widgeturi", appleHealth:"Apple Health",
  exportReport:"Exportă raport", importData:"Importă date", reportBug:"Raportează o eroare",
  sendFeedback:"Trimite feedback", rateApp:"Evaluează Celeste",
  setupTitle:"Hai să îți configurăm ciclul", getStarted:"Începe", skipSetup:"Omite configurarea",
  followPartner:"Urmăresc ciclul partenerei mele", chooseLanguage:"Alege limba",
  step:"Pasul", of:"din", finishSetup:"Finalizează",
  qLastPeriod:"Când a început ultima menstruație?",
  qCycleLength:"Cât durează ciclul tău?",
  qPeriodLength:"Câte zile durează?",
  qGoal:"Ce te aduce aici?",
  qNotif:"Despre ce să te anunțe Celeste?",
  qShare:"Împarți cu partenerul?",
  pickDate:"Alege o dată", aWeekAgo:"Acum o săptămână", twoWeeksAgo:"Acum două săptămâni",
};

DICT.cs = {
  moreToLog:"Zaznamenat více", hormoneNoteShort:"Hladiny hormonů jsou odvozené z cyklu, ne měřené. Pouze odhady — nejde o antikoncepci.",
  versionHistory:"Historie verzí", chNew:"Nové", chBetter:"Vylepšeno", chFix:"Opraveno",
  changelogLead:"Všechny změny, od nejnovějších.",
  today:"Dnes", calendar:"Kalendář", log:"Zaznamenat", insights:"Přehledy", you:"Ty",
  settings:"Nastavení", partnerView:"Zobrazení pro partnera",
  cont:"Pokračovat", skip:"Přeskočit", done:"Hotovo", back:"Zpět", close:"Zavřít",
  more:"Více", less:"Méně", edit:"Upravit", remove:"Odebrat", notSure:"Nejsem si jistá",
  dontRemember:"Nepamatuji si", notNow:"Teď ne", off:"Vypnuto", showFewer:"Zobrazit méně",
  cycleDay:"Den cyklu", preview:"Náhled", nothingLoggedYet:"Zatím nic nezaznamenáno",
  periodIn:"Menstruace za", periodTomorrow:"Menstruace se čeká zítra",
  periodToday:"Menstruace se čeká dnes", periodLate:"Menstruace se opozdila o",
  expected:"Očekávaná", dragDial:"tažením kruhu se podíváš dopředu",
  todaysHormones:"Tvoje hormony dnes", howPhaseFeels:"Jak tato fáze obvykle probíhá",
  yourPattern:"Tvůj vzorec", typicallyIn:"Obvykle ve fázi",
  logTodayCard:"Zaznamenat dnešek", addMoodSymptoms:"Přidej náladu, příznaky a poznámku",
  avgCycleLabel:"dní průměrný cyklus", avgPeriodLabel:"dní průměrná menstruace",
  assumedCycle:"dní cyklu, odhad", variationLabel:"dní rozptyl",
  notEnoughCycles:"zatím málo cyklů",
  hormoneNote:"Hladiny hormonů jsou odvozené z tvého cyklu, ne měřené. Předpovědi jsou odhady — nejsou antikoncepce ani náhrada lékařské rady.",
  learning:"Učí se", gettingFeel:"Nabírá tvar", tunedToYou:"Vyladěno pro tebe", wellTuned:"Dobře vyladěno",
  cycle:"cyklus", cycles:"cyklů", day:"den", days:"dní", logged:"zaznamenáno",
  phMenstrual:"Menstruační", phFollicular:"Folikulární", phFertile:"Plodné období",
  phLuteal:"Luteální", phLate:"Pozdní luteální", phase:"fáze",
  tagBleeding:"Krvácení", tagBuilding:"Nárůst", tagPeak:"Vrchol",
  tagWinding:"Útlum", tagPMS:"Období PMS",
  month:"Měsíc", year:"Rok", loggedPeriod:"Zaznamenaná menstruace", predicted:"Předpověď",
  fertileWindow:"Plodné období", ovulation:"Ovulace", notesSymptoms:"Poznámky nebo příznaky",
  tapDayHint:"Klepnutím na den zobrazíš záznamy. Podržením otevřeš zápis.",
  tapMonthHint:"Klepnutím na měsíc zobrazíš souhrn. Podržením ho otevřeš.",
  nothingLogged:"Nic nezaznamenáno.", editThisDay:"Upravit tento den", logThisDay:"Zaznamenat tento den",
  daysLogged:"Zaznamenané dny", noPeriodLogged:"Žádná menstruace nezaznamenána", periodWord:"Menstruace",
  flow:"Krvácení", flowNone:"Žádné", flowLight:"Slabé", flowMedium:"Střední", flowHeavy:"Silné",
  clear:"Vymazat", symptoms:"Příznaky", mood:"Nálada", skinHair:"Pleť a vlasy", sexLife:"Sexuální život",
  cervicalMucus:"Cervikální hlen", ovulationTest:"Ovulační test", pregnancyTest:"Těhotenský test",
  breastExam:"Samovyšetření prsou", medicine:"Léky", lifestyle:"Životní styl", note:"Poznámka",
  weight:"Váha", temperature:"Teplota", sleep:"Spánek", water:"Voda", glasses:"sklenic",
  notePlaceholder:"Co si o tomto dni chceš zapamatovat",
  yourPatterns:"Tvoje vzorce", mostLogged:"Nejčastěji", cycleHistory:"Historie cyklů",
  showOlder:"Zobrazit starší cykly", daysBleeding:"krvácení", dayCycleSuffix:"denní cyklus",
  current:"probíhá", noPeriodsYet:"Zatím žádná menstruace.",
  addYourName:"Přidej své jméno", noCycleYet:"Zatím žádný cyklus", dayAverage:" dní průměrně",
  yourProfile:"Tvůj profil", periodCycle:"Menstruace a cyklus", hormonesPhases:"Hormony a fáze",
  notes:"Poznámky", birthControl:"Antikoncepce", pastLogs:"Dřívější záznamy", dataPrivacy:"Data a soukromí",
  exportWord:"Export", reminders:"Připomenutí", partner:"Partner", about:"O aplikaci",
  cycleAnalysis:"Analýza cyklu", partnerMode:"Režim partnera",
  notifications:"Oznámení", appSection:"Aplikace", yourData:"Tvoje data", support:"Podpora",
  cycleReminders:"Připomenutí cyklu", medicineReminders:"Připomenutí léků",
  otherReminders:"Další připomenutí", language:"Jazyk", themeWallpaper:"Vzhled a pozadí",
  displayHide:"Zobrazit a skrýt", widgets:"Widgety", appleHealth:"Apple Health",
  exportReport:"Exportovat zprávu", importData:"Importovat data", reportBug:"Nahlásit chybu",
  sendFeedback:"Odeslat zpětnou vazbu", rateApp:"Ohodnotit Celeste",
  setupTitle:"Pojďme nastavit tvůj cyklus", getStarted:"Začít", skipSetup:"Přeskočit nastavení",
  followPartner:"Sleduji cyklus své partnerky", chooseLanguage:"Vyber si jazyk",
  step:"Krok", of:"z", finishSetup:"Dokončit",
  qLastPeriod:"Kdy začala tvá poslední menstruace?",
  qCycleLength:"Jak dlouhý je tvůj cyklus?",
  qPeriodLength:"Kolik dní trvá?",
  qGoal:"Co tě sem přivedlo?",
  qNotif:"Na co tě má Celeste upozorňovat?",
  qShare:"Sdílet s partnerem?",
  pickDate:"Vyber datum", aWeekAgo:"Před týdnem", twoWeeksAgo:"Před dvěma týdny",
};

DICT.sq = {
  moreToLog:"Më shumë për të regjistruar", hormoneNoteShort:"Nivelet e hormoneve llogariten nga cikli, nuk maten. Vetëm vlerësime — nuk janë kontracepsion.",
  versionHistory:"Historiku i versioneve", chNew:"E re", chBetter:"Përmirësuar", chFix:"Rregulluar",
  changelogLead:"Të gjitha ndryshimet, më të rejat në fillim.",
  today:"Sot", calendar:"Kalendari", log:"Regjistro", insights:"Analiza", you:"Ti",
  settings:"Cilësimet", partnerView:"Pamja e partnerit",
  cont:"Vazhdo", skip:"Kapërce", done:"U krye", back:"Prapa", close:"Mbyll",
  more:"Më shumë", less:"Më pak", edit:"Ndrysho", remove:"Hiq", notSure:"Nuk jam e sigurt",
  dontRemember:"Nuk e mbaj mend", notNow:"Jo tani", off:"Joaktive", showFewer:"Shfaq më pak",
  cycleDay:"Dita e ciklit", preview:"Parapamje", nothingLoggedYet:"Ende asgjë e regjistruar",
  periodIn:"Menstruacionet pas", periodTomorrow:"Menstruacionet priten nesër",
  periodToday:"Menstruacionet priten sot", periodLate:"Menstruacionet vonuar me",
  expected:"Pritet", dragDial:"tërhiq rrethin për të parë përpara",
  todaysHormones:"Hormonet e tua sot", howPhaseFeels:"Si ndihet zakonisht kjo fazë",
  yourPattern:"Modeli yt", typicallyIn:"Zakonisht në fazën",
  logTodayCard:"Regjistro sot", addMoodSymptoms:"Shto humor, simptoma dhe një shënim",
  avgCycleLabel:"ditë cikël mesatar", avgPeriodLabel:"ditë menstruacione mesatare",
  assumedCycle:"ditë cikli, e supozuar", variationLabel:"ditë ndryshim",
  notEnoughCycles:"ende pak cikle",
  hormoneNote:"Nivelet e hormoneve llogariten nga cikli yt, nuk maten. Parashikimet janë vlerësime — nuk janë kontracepsion dhe nuk zëvendësojnë këshillën mjekësore.",
  learning:"Po mëson", gettingFeel:"Po merr formë", tunedToYou:"Përshtatur për ty", wellTuned:"Mirë e përshtatur",
  cycle:"cikël", cycles:"cikle", day:"ditë", days:"ditë", logged:"të regjistruara",
  phMenstrual:"Menstruale", phFollicular:"Folikulare", phFertile:"Dritarja pjellore",
  phLuteal:"Luteale", phLate:"Luteale e vonshme", phase:"faza",
  tagBleeding:"Gjakderdhje", tagBuilding:"Në rritje", tagPeak:"Kulmi",
  tagWinding:"Në rënie", tagPMS:"Periudha PMS",
  month:"Muaji", year:"Viti", loggedPeriod:"Menstruacione të regjistruara", predicted:"Parashikuar",
  fertileWindow:"Dritarja pjellore", ovulation:"Ovulacioni", notesSymptoms:"Shënime ose simptoma",
  tapDayHint:"Prek një ditë për të parë regjistrimet. Mbaje shtypur për ta hapur.",
  tapMonthHint:"Prek një muaj për përmbledhjen. Mbaje shtypur për ta hapur.",
  nothingLogged:"Asgjë e regjistruar.", editThisDay:"Ndrysho këtë ditë", logThisDay:"Regjistro këtë ditë",
  daysLogged:"Ditë të regjistruara", noPeriodLogged:"Asnjë menstruacion i regjistruar", periodWord:"Menstruacionet",
  flow:"Rrjedha", flowNone:"Asnjë", flowLight:"E lehtë", flowMedium:"Mesatare", flowHeavy:"E rëndë",
  clear:"Pastro", symptoms:"Simptomat", mood:"Humori", skinHair:"Lëkura dhe flokët", sexLife:"Jeta seksuale",
  cervicalMucus:"Mukusi i qafës së mitrës", ovulationTest:"Testi i ovulacionit", pregnancyTest:"Testi i shtatzënisë",
  breastExam:"Vetëkontrolli i gjirit", medicine:"Ilaçet", lifestyle:"Stili i jetesës", note:"Shënim",
  weight:"Pesha", temperature:"Temperatura", sleep:"Gjumi", water:"Uji", glasses:"gota",
  notePlaceholder:"Diçka që ia vlen të mbahet mend për këtë ditë",
  yourPatterns:"Modelet e tua", mostLogged:"Më të regjistruarat", cycleHistory:"Historiku i cikleve",
  showOlder:"Shfaq ciklet e mëparshme", daysBleeding:"gjakderdhje", dayCycleSuffix:" ditë cikël",
  current:"në vazhdim", noPeriodsYet:"Ende asnjë menstruacion i regjistruar.",
  addYourName:"Shto emrin tënd", noCycleYet:"Ende asnjë cikël", dayAverage:" ditë mesatarisht",
  yourProfile:"Profili yt", periodCycle:"Menstruacionet dhe cikli", hormonesPhases:"Hormonet dhe fazat",
  notes:"Shënimet", birthControl:"Kontracepsioni", pastLogs:"Regjistrimet e kaluara", dataPrivacy:"Të dhënat dhe privatësia",
  exportWord:"Eksporto", reminders:"Kujtesat", partner:"Partneri", about:"Rreth",
  cycleAnalysis:"Analiza e ciklit", partnerMode:"Modaliteti i partnerit",
  notifications:"Njoftimet", appSection:"Aplikacioni", yourData:"Të dhënat e tua", support:"Ndihma",
  cycleReminders:"Kujtesat e ciklit", medicineReminders:"Kujtesat e ilaçeve",
  otherReminders:"Kujtesa të tjera", language:"Gjuha", themeWallpaper:"Tema dhe sfondi",
  displayHide:"Shfaq dhe fshih", widgets:"Widget-et", appleHealth:"Apple Health",
  exportReport:"Eksporto raportin", importData:"Importo të dhënat", reportBug:"Raporto një gabim",
  sendFeedback:"Dërgo koment", rateApp:"Vlerëso Celeste",
  setupTitle:"Le ta konfigurojmë ciklin tënd", getStarted:"Fillo", skipSetup:"Kapërce konfigurimin",
  followPartner:"Po ndjek ciklin e partneres sime", chooseLanguage:"Zgjidh gjuhën",
  step:"Hapi", of:"nga", finishSetup:"Përfundo",
  qLastPeriod:"Kur filluan menstruacionet e fundit?",
  qCycleLength:"Sa zgjat cikli yt?",
  qPeriodLength:"Sa ditë zgjasin?",
  qGoal:"Çfarë të solli këtu?",
  qNotif:"Për çfarë duhet të të njoftojë Celeste?",
  qShare:"Ta ndash me partnerin?",
  pickDate:"Zgjidh një datë", aWeekAgo:"Një javë më parë", twoWeeksAgo:"Dy javë më parë",
};

/* Translations below cover the interface. Anything missing falls back to English. */
DICT.es = {
  moreToLog:"Más para registrar", hormoneNoteShort:"Los niveles hormonales se estiman a partir de tu ciclo, no se miden. Solo estimaciones — no son anticonceptivas.",
  versionHistory:"Historial de versiones", chNew:"Nuevo", chBetter:"Mejorado", chFix:"Corregido",
  changelogLead:"Todos los cambios, del más reciente al más antiguo.",
  today:"Hoy", calendar:"Calendario", log:"Registrar", insights:"Análisis", you:"Tú",
  settings:"Ajustes", partnerView:"Vista de pareja",
  cont:"Continuar", skip:"Omitir", done:"Hecho", back:"Atrás", close:"Cerrar",
  more:"Más", less:"Menos", edit:"Editar", remove:"Eliminar", notSure:"No estoy segura",
  dontRemember:"No lo recuerdo", notNow:"Ahora no", off:"Desactivado", showFewer:"Mostrar menos",
  cycleDay:"Día del ciclo", preview:"Vista previa", nothingLoggedYet:"Nada registrado todavía",
  periodIn:"Periodo en", periodTomorrow:"Periodo previsto mañana",
  periodToday:"Periodo previsto hoy", periodLate:"El periodo se retrasa",
  expected:"Previsto", dragDial:"desliza el círculo para ver más adelante",
  todaysHormones:"Tus hormonas hoy", howPhaseFeels:"Cómo suele sentirse esta fase",
  yourPattern:"Tu patrón", typicallyIn:"Normalmente en la fase",
  logTodayCard:"Registrar hoy", addMoodSymptoms:"Añade ánimo, síntomas y una nota",
  avgCycleLabel:"días de ciclo medio", avgPeriodLabel:"días de periodo medio",
  assumedCycle:"días de ciclo, estimado", variationLabel:"días de variación",
  notEnoughCycles:"aún faltan ciclos",
  hormoneNote:"Los niveles hormonales se modelan a partir de tu ciclo, no se miden. Las predicciones son estimaciones — no son anticonceptivas ni sustituyen el consejo médico.",
  learning:"Aprendiendo", gettingFeel:"Tomando forma", tunedToYou:"Ajustado a ti", wellTuned:"Bien ajustado",
  cycle:"ciclo", cycles:"ciclos", day:"día", days:"días", logged:"registrados",
  phMenstrual:"Menstrual", phFollicular:"Folicular", phFertile:"Ventana fértil",
  phLuteal:"Lútea", phLate:"Lútea tardía", phase:"fase",
  tagBleeding:"Sangrado", tagBuilding:"En aumento", tagPeak:"Punto máximo",
  tagWinding:"Bajando", tagPMS:"Ventana premenstrual",
  month:"Mes", year:"Año", loggedPeriod:"Periodo registrado", predicted:"Previsto",
  fertileWindow:"Ventana fértil", ovulation:"Ovulación", notesSymptoms:"Notas o síntomas",
  tapDayHint:"Toca un día para ver lo registrado. Mantén pulsado para abrir el registro.",
  tapMonthHint:"Toca un mes para ver el resumen. Mantén pulsado para abrirlo.",
  nothingLogged:"Nada registrado.", editThisDay:"Editar este día", logThisDay:"Registrar este día",
  daysLogged:"Días registrados", noPeriodLogged:"Sin periodo registrado", periodWord:"Periodo",
  flow:"Flujo", flowNone:"Ninguno", flowLight:"Ligero", flowMedium:"Medio", flowHeavy:"Abundante",
  clear:"Borrar", symptoms:"Síntomas", mood:"Ánimo", skinHair:"Piel y pelo", sexLife:"Vida sexual",
  cervicalMucus:"Moco cervical", ovulationTest:"Test de ovulación", pregnancyTest:"Test de embarazo",
  breastExam:"Autoexploración mamaria", medicine:"Medicación", lifestyle:"Hábitos", note:"Nota",
  weight:"Peso", temperature:"Temperatura", sleep:"Sueño", water:"Agua", glasses:"vasos",
  notePlaceholder:"Algo que quieras recordar de este día",
  yourPatterns:"Tus patrones", mostLogged:"Lo más registrado", cycleHistory:"Historial de ciclos",
  showOlder:"Ver ciclos anteriores", daysBleeding:"de sangrado", dayCycleSuffix:" días de ciclo",
  current:"actual", noPeriodsYet:"Aún no hay periodos registrados.",
  addYourName:"Añade tu nombre", noCycleYet:"Sin ciclo todavía", dayAverage:" días de media",
  yourProfile:"Tu perfil", periodCycle:"Periodo y ciclo", hormonesPhases:"Hormonas y fases",
  notes:"Notas", birthControl:"Anticoncepción", pastLogs:"Registros anteriores", dataPrivacy:"Datos y privacidad",
  exportWord:"Exportar", reminders:"Recordatorios", partner:"Pareja", about:"Acerca de",
  cycleAnalysis:"Análisis del ciclo", partnerMode:"Modo pareja",
  notifications:"Notificaciones", appSection:"Aplicación", yourData:"Tus datos", support:"Ayuda",
  cycleReminders:"Recordatorios del ciclo", medicineReminders:"Recordatorios de medicación",
  otherReminders:"Otros recordatorios", language:"Idioma", themeWallpaper:"Tema y fondo",
  displayHide:"Mostrar y ocultar", widgets:"Widgets", appleHealth:"Apple Salud",
  exportReport:"Exportar informe", importData:"Importar datos", reportBug:"Informar de un fallo",
  sendFeedback:"Enviar comentarios", rateApp:"Valorar Celeste",
  setupTitle:"Vamos a configurar tu ciclo", getStarted:"Empezar", skipSetup:"Omitir configuración",
  followPartner:"Sigo el ciclo de mi pareja", chooseLanguage:"Elige tu idioma",
  step:"Paso", of:"de", finishSetup:"Finalizar",
  qLastPeriod:"¿Cuándo empezó tu último periodo?",
  qCycleLength:"¿Cuánto dura tu ciclo?",
  qPeriodLength:"¿Cuántos días dura?",
  qGoal:"¿Qué te trae por aquí?",
  qNotif:"¿De qué quieres que te avise Celeste?",
  qShare:"¿Compartir con tu pareja?",
  pickDate:"Elige una fecha", aWeekAgo:"Hace una semana", twoWeeksAgo:"Hace dos semanas",
};

DICT.de = {
  moreToLog:"Mehr eintragen", hormoneNoteShort:"Hormonwerte werden aus deinem Zyklus berechnet, nicht gemessen. Nur Schätzungen — keine Verhütung.",
  versionHistory:"Versionsverlauf", chNew:"Neu", chBetter:"Verbessert", chFix:"Behoben",
  changelogLead:"Alle Änderungen, neueste zuerst.",
  today:"Heute", calendar:"Kalender", log:"Eintragen", insights:"Auswertung", you:"Du",
  settings:"Einstellungen", partnerView:"Partneransicht",
  cont:"Weiter", skip:"Überspringen", done:"Fertig", back:"Zurück", close:"Schließen",
  more:"Mehr", less:"Weniger", edit:"Bearbeiten", remove:"Entfernen", notSure:"Ich bin nicht sicher",
  dontRemember:"Weiß ich nicht mehr", notNow:"Jetzt nicht", off:"Aus", showFewer:"Weniger anzeigen",
  cycleDay:"Zyklustag", preview:"Vorschau", nothingLoggedYet:"Noch nichts eingetragen",
  periodIn:"Periode in", periodTomorrow:"Periode morgen erwartet",
  periodToday:"Periode heute erwartet", periodLate:"Periode überfällig seit",
  expected:"Erwartet", dragDial:"zieh am Kreis, um vorauszuschauen",
  todaysHormones:"Deine Hormone heute", howPhaseFeels:"Wie sich diese Phase meist anfühlt",
  yourPattern:"Dein Muster", typicallyIn:"Typisch in der",
  logTodayCard:"Heute eintragen", addMoodSymptoms:"Stimmung, Symptome und Notiz hinzufügen",
  avgCycleLabel:"Tage Zyklus im Schnitt", avgPeriodLabel:"Tage Periode im Schnitt",
  assumedCycle:"Tage Zyklus, angenommen", variationLabel:"Tage Schwankung",
  notEnoughCycles:"noch zu wenige Zyklen",
  hormoneNote:"Die Hormonwerte werden aus deinem Zyklus berechnet, nicht gemessen. Vorhersagen sind Schätzungen — keine Verhütung und kein Ersatz für ärztlichen Rat.",
  learning:"Lernt noch", gettingFeel:"Wird konkreter", tunedToYou:"Auf dich abgestimmt", wellTuned:"Gut abgestimmt",
  cycle:"Zyklus", cycles:"Zyklen", day:"Tag", days:"Tage", logged:"eingetragen",
  phMenstrual:"Menstruation", phFollicular:"Follikelphase", phFertile:"Fruchtbare Tage",
  phLuteal:"Lutealphase", phLate:"Späte Lutealphase", phase:"Phase",
  tagBleeding:"Blutung", tagBuilding:"Aufbau", tagPeak:"Höhepunkt",
  tagWinding:"Rückgang", tagPMS:"PMS-Fenster",
  month:"Monat", year:"Jahr", loggedPeriod:"Eingetragene Periode", predicted:"Vorhergesagt",
  fertileWindow:"Fruchtbare Tage", ovulation:"Eisprung", notesSymptoms:"Notizen oder Symptome",
  tapDayHint:"Tippe auf einen Tag, um Einträge zu sehen. Halte ihn, um einzutragen.",
  tapMonthHint:"Tippe auf einen Monat für die Übersicht. Halte ihn, um ihn zu öffnen.",
  nothingLogged:"Nichts eingetragen.", editThisDay:"Diesen Tag bearbeiten", logThisDay:"Diesen Tag eintragen",
  daysLogged:"Eingetragene Tage", noPeriodLogged:"Keine Periode eingetragen", periodWord:"Periode",
  flow:"Blutung", flowNone:"Keine", flowLight:"Leicht", flowMedium:"Mittel", flowHeavy:"Stark",
  clear:"Löschen", symptoms:"Symptome", mood:"Stimmung", skinHair:"Haut & Haare", sexLife:"Sexleben",
  cervicalMucus:"Zervixschleim", ovulationTest:"Ovulationstest", pregnancyTest:"Schwangerschaftstest",
  breastExam:"Brust-Selbstuntersuchung", medicine:"Medikamente", lifestyle:"Alltag", note:"Notiz",
  weight:"Gewicht", temperature:"Temperatur", sleep:"Schlaf", water:"Wasser", glasses:"Gläser",
  notePlaceholder:"Was du dir zu diesem Tag merken möchtest",
  yourPatterns:"Deine Muster", mostLogged:"Am häufigsten", cycleHistory:"Zyklusverlauf",
  showOlder:"Ältere Zyklen anzeigen", daysBleeding:"Blutung", dayCycleSuffix:" Tage Zyklus",
  current:"laufend", noPeriodsYet:"Noch keine Periode eingetragen.",
  addYourName:"Namen hinzufügen", noCycleYet:"Noch kein Zyklus", dayAverage:" Tage im Schnitt",
  yourProfile:"Dein Profil", periodCycle:"Periode & Zyklus", hormonesPhases:"Hormone & Phasen",
  notes:"Notizen", birthControl:"Verhütung", pastLogs:"Frühere Einträge", dataPrivacy:"Daten & Datenschutz",
  exportWord:"Export", reminders:"Erinnerungen", partner:"Partner", about:"Über",
  cycleAnalysis:"Zyklusanalyse", partnerMode:"Partnermodus",
  notifications:"Mitteilungen", appSection:"App", yourData:"Deine Daten", support:"Hilfe",
  cycleReminders:"Zyklus-Erinnerungen", medicineReminders:"Medikamenten-Erinnerungen",
  otherReminders:"Weitere Erinnerungen", language:"Sprache", themeWallpaper:"Design & Hintergrund",
  displayHide:"Anzeigen & ausblenden", widgets:"Widgets", appleHealth:"Apple Health",
  exportReport:"Bericht exportieren", importData:"Daten importieren", reportBug:"Fehler melden",
  sendFeedback:"Feedback senden", rateApp:"Celeste bewerten",
  setupTitle:"Richten wir deinen Zyklus ein", getStarted:"Los geht's", skipSetup:"Einrichtung überspringen",
  followPartner:"Ich verfolge den Zyklus meiner Partnerin", chooseLanguage:"Sprache wählen",
  step:"Schritt", of:"von", finishSetup:"Einrichtung abschließen",
  qLastPeriod:"Wann hat deine letzte Periode begonnen?",
  qCycleLength:"Wie lang ist dein Zyklus?",
  qPeriodLength:"Wie viele Tage dauert sie?",
  qGoal:"Was führt dich her?",
  qNotif:"Worüber soll Celeste dich informieren?",
  qShare:"Mit einer Partnerin teilen?",
  pickDate:"Datum wählen", aWeekAgo:"Vor einer Woche", twoWeeksAgo:"Vor zwei Wochen",
};

DICT.it = {
  moreToLog:"Altro da registrare", hormoneNoteShort:"I livelli ormonali sono stimati dal tuo ciclo, non misurati. Solo stime — non sono un contraccettivo.",
  versionHistory:"Cronologia versioni", chNew:"Nuovo", chBetter:"Migliorato", chFix:"Corretto",
  changelogLead:"Tutte le modifiche, dalla più recente.",
  today:"Oggi", calendar:"Calendario", log:"Registra", insights:"Analisi", you:"Tu",
  settings:"Impostazioni", partnerView:"Vista partner",
  cont:"Continua", skip:"Salta", done:"Fatto", back:"Indietro", close:"Chiudi",
  more:"Altro", less:"Meno", edit:"Modifica", remove:"Rimuovi", notSure:"Non sono sicura",
  dontRemember:"Non ricordo", notNow:"Non ora", off:"Disattivato", showFewer:"Mostra meno",
  cycleDay:"Giorno del ciclo", preview:"Anteprima", nothingLoggedYet:"Ancora nulla registrato",
  periodIn:"Mestruazioni tra", periodTomorrow:"Mestruazioni previste domani",
  periodToday:"Mestruazioni previste oggi", periodLate:"Mestruazioni in ritardo di",
  expected:"Previste", dragDial:"trascina il cerchio per guardare avanti",
  todaysHormones:"I tuoi ormoni oggi", howPhaseFeels:"Come ci si sente di solito in questa fase",
  yourPattern:"Il tuo schema", typicallyIn:"Di solito nella fase",
  logTodayCard:"Registra oggi", addMoodSymptoms:"Aggiungi umore, sintomi e una nota",
  avgCycleLabel:"giorni di ciclo medio", avgPeriodLabel:"giorni di mestruazioni medie",
  assumedCycle:"giorni di ciclo, stimato", variationLabel:"giorni di variazione",
  notEnoughCycles:"cicli ancora insufficienti",
  hormoneNote:"I livelli ormonali sono stimati dal tuo ciclo, non misurati. Le previsioni sono stime — non sono un contraccettivo né sostituiscono il parere medico.",
  learning:"Sta imparando", gettingFeel:"Prende forma", tunedToYou:"Calibrata su di te", wellTuned:"Ben calibrata",
  cycle:"ciclo", cycles:"cicli", day:"giorno", days:"giorni", logged:"registrati",
  phMenstrual:"Mestruale", phFollicular:"Follicolare", phFertile:"Finestra fertile",
  phLuteal:"Luteale", phLate:"Luteale tardiva", phase:"fase",
  tagBleeding:"Flusso", tagBuilding:"In crescita", tagPeak:"Picco",
  tagWinding:"In calo", tagPMS:"Finestra premestruale",
  month:"Mese", year:"Anno", loggedPeriod:"Mestruazioni registrate", predicted:"Previste",
  fertileWindow:"Finestra fertile", ovulation:"Ovulazione", notesSymptoms:"Note o sintomi",
  tapDayHint:"Tocca un giorno per vedere cosa hai registrato. Tieni premuto per aprire il registro.",
  tapMonthHint:"Tocca un mese per il riepilogo. Tieni premuto per aprirlo.",
  nothingLogged:"Nulla registrato.", editThisDay:"Modifica questo giorno", logThisDay:"Registra questo giorno",
  daysLogged:"Giorni registrati", noPeriodLogged:"Nessuna mestruazione registrata", periodWord:"Mestruazioni",
  flow:"Flusso", flowNone:"Nessuno", flowLight:"Leggero", flowMedium:"Medio", flowHeavy:"Abbondante",
  clear:"Cancella", symptoms:"Sintomi", mood:"Umore", skinHair:"Pelle e capelli", sexLife:"Vita sessuale",
  cervicalMucus:"Muco cervicale", ovulationTest:"Test di ovulazione", pregnancyTest:"Test di gravidanza",
  breastExam:"Autopalpazione del seno", medicine:"Farmaci", lifestyle:"Stile di vita", note:"Nota",
  weight:"Peso", temperature:"Temperatura", sleep:"Sonno", water:"Acqua", glasses:"bicchieri",
  notePlaceholder:"Qualcosa da ricordare di questo giorno",
  yourPatterns:"I tuoi schemi", mostLogged:"Più registrati", cycleHistory:"Storico dei cicli",
  showOlder:"Mostra cicli precedenti", daysBleeding:"di flusso", dayCycleSuffix:" giorni di ciclo",
  current:"in corso", noPeriodsYet:"Nessuna mestruazione registrata.",
  addYourName:"Aggiungi il tuo nome", noCycleYet:"Nessun ciclo", dayAverage:" giorni in media",
  yourProfile:"Il tuo profilo", periodCycle:"Mestruazioni e ciclo", hormonesPhases:"Ormoni e fasi",
  notes:"Note", birthControl:"Contraccezione", pastLogs:"Registrazioni passate", dataPrivacy:"Dati e privacy",
  exportWord:"Esporta", reminders:"Promemoria", partner:"Partner", about:"Informazioni",
  cycleAnalysis:"Analisi del ciclo", partnerMode:"Modalità partner",
  notifications:"Notifiche", appSection:"App", yourData:"I tuoi dati", support:"Assistenza",
  cycleReminders:"Promemoria del ciclo", medicineReminders:"Promemoria farmaci",
  otherReminders:"Altri promemoria", language:"Lingua", themeWallpaper:"Tema e sfondo",
  displayHide:"Mostra e nascondi", widgets:"Widget", appleHealth:"Apple Salute",
  exportReport:"Esporta report", importData:"Importa dati", reportBug:"Segnala un problema",
  sendFeedback:"Invia un commento", rateApp:"Valuta Celeste",
  setupTitle:"Configuriamo il tuo ciclo", getStarted:"Iniziamo", skipSetup:"Salta la configurazione",
  followPartner:"Seguo il ciclo della mia partner", chooseLanguage:"Scegli la lingua",
  step:"Passo", of:"di", finishSetup:"Completa",
  qLastPeriod:"Quando sono iniziate le ultime mestruazioni?",
  qCycleLength:"Quanto dura il tuo ciclo?",
  qPeriodLength:"Quanti giorni durano?",
  qGoal:"Cosa ti porta qui?",
  qNotif:"Di cosa vuoi essere avvisata?",
  qShare:"Condividere con il partner?",
  pickDate:"Scegli una data", aWeekAgo:"Una settimana fa", twoWeeksAgo:"Due settimane fa",
};

const VERSION = "1.2";

/* Version history. Newest first. Add an entry with every release —
   type is "new", "better" or "fix". */
const CHANGELOG = [
  { v: "1.2", date: "2026-08-27", notes: [
    { t: "better", x: "Today is calmer — the three stat tiles and the tuning meter became one quiet line, and the tuning meter now lives only in Insights where it belongs." },
    { t: "better", x: "The log opens with flow, symptoms, mood and a note. Everything occasional sits behind one More button, and anything already filled in stays visible." },
    { t: "better", x: "Removed the duplicate Export and Data buttons from the You tab." },
    { t: "better", x: "Cut a third of the explanatory boxes and shortened the rest." },
  ] },
  { v: "1.1.2", date: "2026-08-27", notes: [
    { t: "fix", x: "The You tab was still blank — an earlier edit had removed the icon set and the profile, partner, import and setup screens. All restored, and every screen is now render-tested before release." },
  ] },
  { v: "1.1.1", date: "2026-08-27", notes: [
    { t: "fix", x: "Opening the You tab showed a blank screen." },
    { t: "fix", x: "The whole page scrolled instead of just the content, so the tab bar drifted away. It is now fixed in place." },
    { t: "better", x: "Logging opens as a sheet over the app rather than taking the screen." },
  ] },
  { v: "1.1", date: "2026-08-27", notes: [
    { t: "fix", x: "Choosing a language did nothing — the setting saved but nothing read it. The interface now translates into all twelve languages." },
    { t: "new", x: "Version history, so you can see what changed and when." },
    { t: "better", x: "Cycle history in Insights shows three cycles, with the rest behind a toggle." },
    { t: "better", x: "Each cycle expands to reveal the days logged inside it." },
    { t: "new", x: "Version number beside the app name." },
  ] },
  { v: "1.0", date: "2026-08-26", notes: [
    { t: "new", x: "Renamed to Celeste." },
    { t: "new", x: "Profile — add a name and photo, with a flower as the default." },
    { t: "new", x: "Installable as an app: home screen icon, works offline, updates announce themselves." },
    { t: "better", x: "Partner codes carry your cycle length and start date rather than fixed numbers, so a partner's view recalculates itself instead of going stale." },
    { t: "new", x: "Share codes can expire after 30 days, 90 days, a year, or never." },
  ] },
  { v: "0.9", date: "2026-08-26", notes: [
    { t: "new", x: "First-run setup: last period, cycle length, period length, goal and reminders — every question skippable." },
    { t: "new", x: "Language can be chosen before setup begins." },
    { t: "new", x: "A separate path for partners, which skips the cycle questions entirely." },
    { t: "new", x: "Import from Clue, Flo, a spreadsheet, or a plain list of period dates, with a preview before anything is written and an undo after." },
  ] },
  { v: "0.8", date: "2026-08-26", notes: [
    { t: "new", x: "Partner mode. Every field is opt-in, notes and sex life are off by default, and you see their view before sending anything." },
    { t: "new", x: "Full settings: reminders, medicine, language, theme, wallpapers, display options, widgets, Apple Health and report export." },
    { t: "new", x: "Dark mode and six wallpapers, two of them animated." },
  ] },
  { v: "0.7", date: "2026-08-26", notes: [
    { t: "better", x: "The You tab became a hub of sub-pages instead of one long scroll." },
    { t: "new", x: "Cycle analysis: period and cycle length variation, trends across your last six cycles, and an editable history." },
    { t: "better", x: "Insights holds only your own data; the phase and hormone reference moved to You." },
  ] },
  { v: "0.6", date: "2026-08-25", notes: [
    { t: "new", x: "Log tab, with flow as the main event and everything else as cards of pills." },
    { t: "better", x: "Removed energy as a separate field." },
    { t: "new", x: "Skin and hair, cervical mucus, test results, breast self-exam, medicine and lifestyle logging." },
    { t: "new", x: "Tap a calendar day to peek at it, hold to open the log." },
  ] },
  { v: "0.5", date: "2026-08-25", notes: [
    { t: "better", x: "The cycle dial became a radial chart — bar height is hormone activity, colour is phase, and you can drag it to look ahead." },
    { t: "better", x: "Logged period days now look different from predicted ones." },
  ] },
  { v: "0.4", date: "2026-08-25", notes: [
    { t: "new", x: "Hormone modelling: oestrogen, progesterone, LH and testosterone estimated from your own cycle length." },
    { t: "new", x: "Phase guidance and a pattern engine that only claims a pattern once it has appeared in two separate cycles." },
    { t: "new", x: "Symptom, mood and note logging, reminders, and birth control that changes what the app shows." },
  ] },
  { v: "0.1", date: "2026-08-25", notes: [
    { t: "new", x: "First version: today's overview, a cycle dial, and a calendar with month and year views." },
  ] },
];


/* ================================= icons ================================= *
 * Kept immediately after the constants so nothing below can accidentally
 * remove them — YOU_TILES and the tab bar reference these by name.
 * ------------------------------------------------------------------------ */
function Drops({ n }) {
  return (
    <span className="ora-drops">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`ora-drop${i < n ? " f" : ""}`} style={i < n ? {} : { opacity: 0.3 }} />
      ))}
    </span>
  );
}
const sc = (a) => (a ? "#c54b8c" : "#8d6b79");
function DropIcon({ active }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5c3.2 3.6 6 6.9 6 10.1a6 6 0 0 1-12 0c0-3.2 2.8-6.5 6-10.1Z"
        fill={active ? "#c54b8c" : "none"} stroke={sc(active)} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function CalIcon({ active }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" fill={active ? "#c54b8c" : "none"} stroke={sc(active)} strokeWidth="1.6" />
      <path d="M3.5 10h17" stroke={active ? "#fff" : "#8d6b79"} strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3" stroke={sc(active)} strokeWidth="1.6" strokeLinecap="round" />
      {active && <circle cx="12" cy="15.5" r="2" fill="#fb74a8" />}
    </svg>
  );
}
function WaveIcon({ active }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path d="M2.5 15c3-9 5.5-9 8.5 0s5.5 6 10.5-4" stroke={sc(active)} strokeWidth={active ? 2.2 : 1.6}
        strokeLinecap="round" strokeLinejoin="round" />
      {active && <circle cx="11" cy="15" r="2" fill="#fb74a8" />}
    </svg>
  );
}
function YouIcon({ active }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.8" fill={active ? "#c54b8c" : "none"} stroke={sc(active)} strokeWidth="1.6" />
      <path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6" stroke={sc(active)} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 5.5v13M5.5 12h13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.2" stroke="#c54b8c" strokeWidth="1.7" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"
        stroke="#c54b8c" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="#8d6b79" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.4" stroke="#c54b8c" strokeWidth="1.6" />
      <path d="M3.6 12h16.8M12 3.6c2.1 2.3 3.2 5.2 3.2 8.4S14.1 18.1 12 20.4c-2.1-2.3-3.2-5.2-3.2-8.4S9.9 5.9 12 3.6Z"
        stroke="#c54b8c" strokeWidth="1.6" />
    </svg>
  );
}

/* tile icons for the You hub */
const TI = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" };
const R = "#c54b8c";
function TileDrop() {
  return <svg {...TI}><path d="M12 3.5c3.2 3.6 6 6.9 6 10.1a6 6 0 0 1-12 0c0-3.2 2.8-6.5 6-10.1Z" fill={R} /></svg>;
}
function TileSpark() {
  return <svg {...TI}><path d="M12 3.5 13.8 9l5.7 1.7-5.7 1.8L12 18l-1.8-5.5L4.5 10.7 10.2 9 12 3.5Z" fill={R} /><circle cx="18.5" cy="18" r="2" fill="#fb74a8" /></svg>;
}
function TileWave() {
  return <svg {...TI}><path d="M2.5 15c3-9 5.5-9 8.5 0s5.5 6 10.5-4" stroke={R} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function TileNote() {
  return <svg {...TI}><rect x="4.5" y="3.5" width="15" height="17" rx="3" stroke={R} strokeWidth="1.8" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" stroke={R} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function TilePill() {
  return <svg {...TI}><rect x="2.8" y="8.5" width="18.4" height="7" rx="3.5" transform="rotate(-40 12 12)" stroke={R} strokeWidth="1.8" /><path d="M9 15.2 15 8.8" stroke={R} strokeWidth="1.8" /></svg>;
}
function TileLock() {
  return <svg {...TI}><rect x="4.5" y="10" width="15" height="10.5" rx="3" stroke={R} strokeWidth="1.8" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke={R} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function TileBell() {
  return <svg {...TI}><path d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6M4.5 17h15M10 20h4" stroke={R} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function TileList() {
  return <svg {...TI}><path d="M9 7h10M9 12h10M9 17h10" stroke={R} strokeWidth="1.8" strokeLinecap="round" /><circle cx="5.2" cy="7" r="1.3" fill={R} /><circle cx="5.2" cy="12" r="1.3" fill={R} /><circle cx="5.2" cy="17" r="1.3" fill={R} /></svg>;
}
function TileInfo() {
  return <svg {...TI}><circle cx="12" cy="12" r="8.5" stroke={R} strokeWidth="1.8" /><path d="M12 11v5.5" stroke={R} strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="7.8" r="1.2" fill={R} /></svg>;
}
function TileHeart() {
  return <svg {...TI}><path d="M12 20S3.8 15.2 3.8 9.8A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 8.2 2.4C20.2 15.2 12 20 12 20Z" fill={R} /></svg>;
}

/* ---------------------------- hormone model ---------------------------- */
function curve(anchors, cycleLen) {
  const pts = anchors
    .map(([d, v]) => [Math.min(Math.max(d, 1), cycleLen), Math.max(0, Math.min(100, v))])
    .sort((a, b) => a[0] - b[0]);
  const clean = [];
  for (const pt of pts) {
    if (clean.length && Math.abs(clean[clean.length - 1][0] - pt[0]) < 0.01) clean[clean.length - 1] = pt;
    else clean.push(pt);
  }
  return (day) => {
    const x = Math.min(Math.max(day, 1), cycleLen);
    if (x <= clean[0][0]) return clean[0][1];
    if (x >= clean[clean.length - 1][0]) return clean[clean.length - 1][1];
    for (let i = 1; i < clean.length; i++) {
      if (x <= clean[i][0]) {
        const [x0, y0] = clean[i - 1];
        const [x1, y1] = clean[i];
        const t = (x - x0) / (x1 - x0);
        const e = (1 - Math.cos(t * Math.PI)) / 2;
        return y0 + (y1 - y0) * e;
      }
    }
    return clean[clean.length - 1][1];
  };
}

function buildHormones(cycleLen, periodLen, suppressed) {
  const L = Math.max(21, Math.min(45, cycleLen));
  const ov = L - 13;
  const P = Math.min(periodLen, 8);

  let e = curve([[1,18],[P,24],[ov-6,48],[ov-1,100],[ov+1,52],[ov+2,40],[ov+7,66],[L-2,24],[L,16]], L);
  let p = curve([[1,6],[ov-1,5],[ov+1,20],[ov+3,58],[ov+7,100],[ov+10,72],[L-2,20],[L,8]], L);
  let lh = curve([[1,9],[ov-3,11],[ov-0.6,92],[ov,100],[ov+1,34],[ov+2,11],[L,9]], L);
  let t = curve([[1,32],[ov-2,56],[ov,70],[ov+3,46],[L-1,36],[L,33]], L);

  if (suppressed) {
    const damp = (f, base, k) => (d) => Math.max(0, Math.min(100, base + (f(d) - 50) * k));
    const bleedDip = (f) => (d) => (d <= P ? f(d) * 0.45 : f(d));
    e = bleedDip(damp(e, 40, 0.1));
    p = damp(p, 14, 0.06);
    lh = damp(lh, 8, 0.05);
    t = damp(t, 28, 0.1);
  }
  return { e, p, lh, t, ov, L };
}

function phaseFor(cycleDay, cycleLen, periodLen) {
  if (!cycleDay || cycleDay < 1) return null;
  const ov = cycleLen - 13;
  if (cycleDay <= periodLen) return "menstrual";
  if (cycleDay >= ov - 5 && cycleDay <= ov + 1) return "fertile";
  if (cycleDay < ov - 5) return "follicular";
  if (cycleDay > cycleLen - 5) return "late";
  return "luteal";
}

/* ================================= app ================================= */
const LOG_FIELDS = ["flows","moods","symptoms","skin","sex","discharge","ovTest","pregTest",
  "breast","meds","bcLog","weight","temp","sleep","water","notes"];
const loggedDates = (data) => {
  const set = new Set();
  LOG_FIELDS.forEach((f) => Object.keys(data[f] || {}).forEach((d) => set.add(d)));
  return [...set].sort();
};

const BLANK = {
  flows: {}, moods: {}, symptoms: {}, notes: {}, discharge: {}, bcLog: {},
  sex: {}, skin: {}, breast: {}, ovTest: {}, pregTest: {}, meds: {},
  profile: { name: "", photo: "" },
  weight: {}, temp: {}, sleep: {}, water: {},
  settings: {
    bcMethod: "none", pillTime: "21:00", remindPeriod: 2, remindPms: true, remindOvulation: false, remindPill: true,
    reminders: {
      periodStart: { on: true, days: 2, time: "09:00", message: "" },
      periodEnd: { on: false, days: 0, time: "09:00", message: "" },
      logPeriod: { on: true, days: 0, time: "20:00", message: "" },
      fertile: { on: false, days: 1, time: "09:00", message: "" },
      ovulation: { on: false, days: 0, time: "09:00", message: "" },
    },
    medicine: { contraceptive: { on: false, time: "21:00" }, others: [] },
    other: {
      dailyLog: { on: false, time: "20:00" },
      breastExam: { on: false, day: 7, time: "10:00" },
      water: { on: false, from: "08:00", to: "20:00", every: 2 },
    },
    onboarded: false, goal: null, cycleOverride: null, periodOverride: null,
    mode: "self", partnerCode: "",
    language: "en",
    theme: "light",
    wallpaper: "none",
    dateFormat: "d-mmm",
    firstDay: 1,
    show: { symptoms: true, mood: true, fertility: true, sex: false },
    partner: {
      on: false, name: "",
      expiry: 90,
      share: { phase: true, period: true, pms: true, symptoms: true, mood: true,
               fertility: false, notes: false, sex: false, photo: false },
    },
    health: false,
  },
};

export default function App() {
  const [tab, setTab] = useState("today");
  const [data, setData] = useState(BLANK);
  const [loaded, setLoaded] = useState(false);
  const [calMode, setCalMode] = useState("month");
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [sheetDate, setSheetDate] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [openHormone, setOpenHormone] = useState(null);

  const todayISO = useMemo(() => iso(new Date()), []);
  const { flows, moods, symptoms, notes, discharge, bcLog, settings } = data;

  useEffect(() => {
    (async () => {
      try {
        let r = null;
        try { r = await window.storage.get("celeste:data"); }
        catch (e) { r = await window.storage.get("ora:data"); }  /* pre-rename saves */
        if (r && r.value) {
          const parsed = JSON.parse(r.value);
          setData({ ...BLANK, ...parsed, profile: { ...BLANK.profile, ...(parsed.profile || {}) },
            settings: mergeSettings(parsed.settings) });
        }
      } catch (err) { /* nothing saved yet */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try { await window.storage.set("celeste:data", JSON.stringify(data)); }
      catch (err) { console.error("Couldn't save", err); }
    })();
  }, [data, loaded]);

  const setField = (field, date, value) =>
    setData((d) => {
      const map = { ...d[field] };
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) delete map[date];
      else map[date] = value;
      return { ...d, [field]: map };
    });
  const toggleIn = (field, date, item) =>
    setData((d) => {
      const map = { ...d[field] };
      const cur = map[date] || [];
      const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
      if (!next.length) delete map[date]; else map[date] = next;
      return { ...d, [field]: map };
    });
  const setSetting = (k, v) => setData((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));
  const setSub = (group, key, value) =>
    setData((d) => ({ ...d, settings: { ...d.settings, [group]: { ...d.settings[group], [key]: value } } }));
  const setSub2 = (group, id, key, value) =>
    setData((d) => ({ ...d, settings: { ...d.settings, [group]: { ...d.settings[group],
      [id]: { ...d.settings[group][id], [key]: value } } } }));

  /* ------------------------- derive cycles ------------------------- */
  const blocks = useMemo(() => {
    const dates = Object.keys(flows).sort();
    const out = [];
    for (const d of dates) {
      const last = out[out.length - 1];
      if (last && diffISO(last.end, d) === 1) last.end = d;
      else out.push({ start: d, end: d });
    }
    return out;
  }, [flows]);

  const stats = useMemo(() => {
    const ovr = settings.cycleOverride, povr = settings.periodOverride;
    const starts = blocks.map((b) => b.start);
    const diffs = [];
    for (let i = 1; i < starts.length; i++) {
      const d = diffISO(starts[i - 1], starts[i]);
      if (d >= 15 && d <= 60) diffs.push(d);
    }
    const recent = diffs.slice(-6);
    const cycleLen = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : (ovr || 28);
    const lens = blocks.slice(-6).map((b) => diffISO(b.start, b.end) + 1).filter((n) => n <= 12);
    const periodLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : (povr || 5);
    return { cycleLen, periodLen, cycles: recent.length, spread: recent.length > 1 ? Math.max(...recent) - Math.min(...recent) : null };
  }, [blocks, settings.cycleOverride, settings.periodOverride]);

  const { cycleLen, periodLen } = stats;
  const lastStart = blocks.length ? blocks[blocks.length - 1].start : null;
  const cycleDay = lastStart ? diffISO(lastStart, todayISO) + 1 : null;
  const nextStart = lastStart ? addISO(lastStart, cycleLen) : null;
  const daysUntil = nextStart ? diffISO(todayISO, nextStart) : null;
  const stale = cycleDay !== null && cycleDay > cycleLen + 45;
  const phaseKey = stale ? null : phaseFor(cycleDay, cycleLen, periodLen);

  FMT.dateFormat = settings.dateFormat;
  FMT.firstDay = settings.firstDay;
  LANG = settings.language || "en";
  const show = settings.show;
  const method = bcMethod(settings.bcMethod);
  const hormones = useMemo(() => buildHormones(cycleLen, periodLen, method.hormonal), [cycleLen, periodLen, method.hormonal]);

  const { predicted, fertile, ovulation, pmsDays } = useMemo(() => {
    const predicted = new Set(), fertile = new Set(), ovulation = new Set(), pmsDays = new Set();
    if (!lastStart) return { predicted, fertile, ovulation, pmsDays };
    for (let c = 0; c <= 14; c++) {
      const st = addISO(lastStart, c * cycleLen);
      if (c > 0) for (let i = 0; i < periodLen; i++) predicted.add(addISO(st, i));
      for (let i = 4; i >= 1; i--) pmsDays.add(addISO(st, cycleLen - i));
      if (!method.hormonal && settings.show.fertility) {
        const ov = addISO(st, cycleLen - 14);
        ovulation.add(ov);
        for (let i = -5; i <= 1; i++) fertile.add(addISO(ov, i));
      }
    }
    return { predicted, fertile, ovulation, pmsDays };
  }, [lastStart, cycleLen, periodLen, method.hormonal, settings.show.fertility]);

  /* --------------------- personalisation engine --------------------- */
  const patterns = useMemo(() => {
    const perPhase = {};
    PHASE_ORDER.forEach((p) => (perPhase[p] = { cycles: {}, seen: new Set() }));
    const starts = blocks.map((b) => b.start);
    const allDates = new Set([...Object.keys(symptoms), ...Object.keys(moods)]);

    allDates.forEach((date) => {
      let idx = -1;
      for (let i = 0; i < starts.length; i++) if (starts[i] <= date) idx = i;
      if (idx < 0) return;
      const cd = diffISO(starts[idx], date) + 1;
      if (cd > cycleLen + 20) return;
      const ph = phaseFor(cd, cycleLen, periodLen);
      if (!ph) return;
      const bucket = perPhase[ph];
      bucket.seen.add(idx);
      [...(symptoms[date] || []), ...(moods[date] || [])].forEach((t) => {
        if (!bucket.cycles[t]) bucket.cycles[t] = new Set();
        bucket.cycles[t].add(idx);
      });
    });

    const out = {};
    PHASE_ORDER.forEach((p) => {
      const b = perPhase[p];
      out[p] = {
        total: b.seen.size,
        ranked: Object.entries(b.cycles)
          .map(([tag, set]) => ({ tag, count: set.size }))
          .filter((r) => r.count >= 2)
          .sort((a, b2) => b2.count - a.count)
          .slice(0, 4),
      };
    });
    return out;
  }, [symptoms, moods, blocks, cycleLen, periodLen]);

  const loggedDays = new Set([...Object.keys(symptoms), ...Object.keys(moods), ...Object.keys(notes)]).size;
  const tuning = (() => {
    const c = stats.cycles;
    if (c < 1) return { level: 0, label: t("learning"), note: "Predictions use a standard 28-day cycle until you have logged a second period." };
    if (c < 3) return { level: 1, label: t("gettingFeel"), note: "Using your own cycle length now. A couple more cycles and the timing settles." };
    if (c < 6) return { level: 2, label: t("tunedToYou"), note: "Timing comes from your own average, and your symptom patterns are starting to hold up." };
    return { level: 3, label: t("wellTuned"), note: "Six or more cycles logged — predictions and patterns are as personal as this app can make them." };
  })();

  const dayState = (date) => {
    if (flows[date]) return flows[date];
    if (predicted.has(date)) return "predicted";
    if (ovulation.has(date)) return "ovulation";
    if (fertile.has(date)) return "fertile";
    return null;
  };
  const hasAnything = (date) => summarise(date, data).length > 0 || !!notes[date];

  /* ------------------------------ alerts ------------------------------ */
  const alerts = useMemo(() => {
    const list = [];
    if (!lastStart || stale) return list;
    if (settings.remindPeriod !== "off" && daysUntil !== null && daysUntil >= 0 && daysUntil <= Number(settings.remindPeriod))
      list.push({ id: "period", text: daysUntil === 0 ? "Period expected today" : `Period expected in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`, sub: "Reminder set" });
    if (settings.remindPms && pmsDays.has(todayISO))
      list.push({ id: "pms", text: "You're in your PMS window", sub: "The dip is hormonal, not a character flaw" });
    if (settings.remindOvulation && settings.show.fertility && ovulation.has(todayISO))
      list.push({ id: "ov", text: "Ovulation estimated today", sub: "Based on your average cycle length" });
    if (settings.remindPill && method.daily && !bcLog[todayISO])
      list.push({ id: "pill", text: "Pill not logged today", sub: `Reminder at ${settings.pillTime}`, action: "Mark taken" });
    return list;
  }, [lastStart, stale, daysUntil, settings, pmsDays, ovulation, todayISO, method.daily, bcLog]);

  const needsOnboarding = loaded && !settings.onboarded && Object.keys(flows).length === 0
    && loggedDates(data).length === 0;

  const shiftMonth = (n) => setCursor((c) => { const d = new Date(c.year, c.month + n, 1, 12); return { year: d.getFullYear(), month: d.getMonth() }; });
  const grid = monthGrid(cursor.year, cursor.month);

  return (
    <div className={`ora-root${settings.theme === "dark" ? " dark" : ""}`}>
      <style>{CSS}</style>

      <div className={`ora-phone wp-${settings.wallpaper}`}>
        {needsOnboarding && <Onboarding todayISO={todayISO} setData={setData} />}
        {!needsOnboarding && settings.mode === "partner" && (
          <PartnerApp settings={settings} setSetting={setSetting} setData={setData} data={data} />
        )}
        <div className="ora-top">
          <button className="ora-mark" onClick={() => setSettingsOpen("changelog")}>
            cel<span>este</span><i className="ora-ver">{VERSION}</i>
          </button>
          <div className="ora-topright">
            <div className="ora-datestamp">{prettyDate(todayISO)}</div>
            <button className="ora-gear" onClick={() => setSettingsOpen("root")} aria-label="Settings">
              <GearIcon />
            </button>
          </div>
        </div>

        <div className="ora-scroll">
          {tab === "today" && (
            <TodayScreen
              lastStart={lastStart} cycleDay={cycleDay} cycleLen={cycleLen} periodLen={periodLen}
              stats={stats} phaseKey={phaseKey} stale={stale} nextStart={nextStart} daysUntil={daysUntil}
              todayISO={todayISO} flows={flows} moods={moods} symptoms={symptoms}
              bcLog={bcLog} method={method} hormones={hormones} alerts={alerts} patterns={patterns}
              tuning={tuning} setField={setField} setData={setData}
              openHormone={openHormone} setOpenHormone={setOpenHormone}
              onLogToday={() => setSheetDate(todayISO)}
            />
          )}
          {tab === "calendar" && (
            <CalendarScreen
              calMode={calMode} setCalMode={setCalMode} cursor={cursor} setCursor={setCursor}
              shiftMonth={shiftMonth} grid={grid} dayState={dayState} fertile={fertile}
              ovulation={ovulation} todayISO={todayISO} hasAnything={hasAnything} method={method}
              data={data} selected={selectedDay} setSelected={setSelectedDay} show={show}
              blocks={blocks} cycleLen={cycleLen} periodLen={periodLen}
              onPick={setSheetDate}
            />
          )}
          {tab === "insights" && (
            <InsightsScreen patterns={patterns} tuning={tuning} stats={stats} blocks={blocks}
              loggedDays={loggedDays} data={data} show={show} todayISO={todayISO} />
          )}
          {tab === "you" && (
            <YouScreen settings={settings} setSetting={setSetting} setSub={setSub} setSub2={setSub2} method={method} stats={stats}
              blocks={blocks} setData={setData} data={data} onOpenDay={setSheetDate} todayISO={todayISO}
              hormones={hormones} patterns={patterns} cycleDay={cycleDay} phaseKey={phaseKey} />
          )}
        </div>

        {logOpen && (
          <LogSheet close={() => setLogOpen(false)} data={data} setField={setField} toggleIn={toggleIn}
            method={method} show={show} todayISO={todayISO} blocks={blocks}
            cycleLen={cycleLen} periodLen={periodLen} />
        )}

        {sheetDate && (
          <DaySheet
            date={sheetDate} close={() => setSheetDate(null)}
            data={data} method={method} setField={setField} toggleIn={toggleIn} show={show}
            cycleLen={cycleLen} periodLen={periodLen} blocks={blocks}
          />
        )}

        {settingsOpen && (
          <SettingsOverlay initialPage={settingsOpen} close={() => setSettingsOpen(null)} settings={settings}
            setSetting={setSetting} setSub={setSub} setSub2={setSub2} setData={setData} data={data}
            method={method} stats={stats} blocks={blocks} todayISO={todayISO}
            cycleDay={cycleDay} phaseKey={phaseKey} />
        )}

        <nav className="ora-tabs">
          {[
            { id: "today", label: t("today"), Icon: DropIcon },
            { id: "calendar", label: t("calendar"), Icon: CalIcon },
            { id: "log", label: t("log"), Icon: PlusIcon, centre: true },
            { id: "insights", label: t("insights"), Icon: WaveIcon },
            { id: "you", label: t("you"), Icon: YouIcon },
          ].map((item) => (
            <button key={item.id}
              className={`ora-tab${(item.id === "log" ? logOpen : tab === item.id) ? " on" : ""}${item.centre ? " centre" : ""}`}
              onClick={() => (item.id === "log" ? setLogOpen(true) : setTab(item.id))}>
              <span className={item.centre ? "ora-tabknob" : ""}><item.Icon active={tab === item.id} /></span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ================================ today ================================ */
function TodayScreen(props) {
  const { lastStart, cycleDay, cycleLen, periodLen, stats, phaseKey, stale, nextStart, daysUntil,
    todayISO, flows, moods, symptoms, bcLog, method, hormones, alerts, patterns, tuning,
    setField, setData, openHormone, setOpenHormone, onLogToday } = props;
  const [preview, setPreview] = useState(null);

  if (!lastStart) {
    return (
      <div>
        <Dial cycleLen={28} periodLen={5} cycleDay={null} hormones={hormones} />
        <div className="ora-empty">
          <div className="ora-emptytitle">Start with your last period</div>
          <div className="ora-emptybody">
            Mark the days you bled and Celeste works out your cycle length, your phases and where your
            hormones sit. The more you log, the less generic this gets.
          </div>
          <button className="ora-cta" onClick={onLogToday}>Log today</button>
        </div>
      </div>
    );
  }

  const headline = stale ? "It's been a while"
    : daysUntil > 1 ? `${t("periodIn")} ${daysUntil} ${t("days")}`
    : daysUntil === 1 ? t("periodTomorrow")
    : daysUntil === 0 ? t("periodToday")
    : `${t("periodLate")} ${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? t("day") : t("days")}`;

  const todayDay = Math.min(Math.max(cycleDay, 1), cycleLen);
  const viewDay = preview || todayDay;
  const previewing = preview !== null && preview !== todayDay;
  const viewPhaseKey = phaseFor(viewDay, cycleLen, periodLen);
  const phase = viewPhaseKey ? PHASES[viewPhaseKey] : null;
  const mine = viewPhaseKey ? patterns[viewPhaseKey] : null;
  const viewDate = addISO(lastStart, viewDay - 1);
  const reading = HORMONES.map((h) => {
    const now = hormones[h.id](viewDay);
    const prev = hormones[h.id](Math.max(1, viewDay - 1));
    const delta = now - prev;
    return { ...h, value: Math.round(now), dir: delta > 3 ? "rising" : delta < -3 ? "falling" : "steady" };
  });
  const logged = [...(moods[todayISO] || []), ...(symptoms[todayISO] || [])];
  const flowForDay = (day) => flows[addISO(lastStart, day - 1)] || null;

  return (
    <div>
      {alerts.map((a) => (
        <div className="ora-alert" key={a.id}>
          <div>
            <div className="ora-alerttext">{a.text}</div>
            <div className="ora-alertsub">{a.sub}</div>
          </div>
          {a.action && (
            <button className="ora-alertbtn"
              onClick={() => setData((d) => ({ ...d, bcLog: { ...d.bcLog, [todayISO]: true } }))}>
              {a.action}
            </button>
          )}
        </div>
      ))}

      <Dial cycleLen={cycleLen} periodLen={periodLen} cycleDay={todayDay}
        viewDay={viewDay} hormones={hormones} flowForDay={flowForDay} onScrub={setPreview} />

      {previewing ? (
        <button className="ora-previewbar" onClick={() => setPreview(null)}>
          <span>Day {viewDay} · {prettyDate(viewDate)}</span>
          <span className="ora-previewback">Back to today</span>
        </button>
      ) : (
        <>
          <div className="ora-headline">{headline}</div>
          <div className="ora-sub">
            {stale ? "Log your most recent period to bring predictions back."
              : `Expected ${prettyDate(nextStart)} · drag the dial to look ahead`}
          </div>
        </>
      )}

      <div className="ora-card">
        <div className="ora-cardhead">{previewing ? `${t("cycleDay")} ${viewDay}` : t("todaysHormones")}</div>
        <HormoneChart hormones={hormones} cycleLen={cycleLen} cycleDay={viewDay} />
        <div className="ora-hlist">
          {reading.map((h) => (
            <button key={h.id} className={`ora-hrow${openHormone === h.id ? " open" : ""}`}
              onClick={() => setOpenHormone(openHormone === h.id ? null : h.id)}>
              <span className="ora-hname"><i style={{ background: h.colour }} />{h.name}</span>
              <span className="ora-hbar"><span style={{ width: `${h.value}%`, background: h.colour }} /></span>
              <span className="ora-hval">{h.value}<em>{h.dir === "rising" ? "↑" : h.dir === "falling" ? "↓" : "·"}</em></span>
            </button>
          ))}
        </div>
        {openHormone && (() => {
          const h = reading.find((x) => x.id === openHormone);
          return (
            <div className="ora-hdetail">
              <p>{h.what}</p>
              <p className="ora-hnow"><strong>Right now:</strong> {h.value >= 55 ? h.high : h.low}</p>
            </div>
          );
        })()}
        {method.hormonal && (
          <div className="ora-flag">
            You're on the {method.label.toLowerCase()}, so these curves are flattened. Hormonal
            contraception suppresses your own rise and fall, and any bleed is a withdrawal bleed
            rather than a true period.
          </div>
        )}
      </div>

      {phase && (
        <div className="ora-card">
          <div className="ora-cardhead">
            {previewing ? `${t("cycleDay")} ${viewDay}` : t("howPhaseFeels")}
          </div>
          {mine && mine.ranked.length > 0 ? (
            <>
              <div className="ora-youtag">{t("yourPattern")}</div>
              <ul className="ora-bullets mine">
                {mine.ranked.slice(0, 3).map((r) => (
                  <li key={r.tag}>
                    <strong>{r.tag}</strong> — logged in {r.count} of your {mine.total} {mine.total === 1 ? "cycle" : "cycles"} at this point
                  </li>
                ))}
              </ul>
              <div className="ora-divider" />
            </>
          ) : (
            <div className="ora-learnnote">
              Log how you feel today and this fills with your own patterns instead of the general picture.
            </div>
          )}
          <div className="ora-youtag muted">{t("typicallyIn")} {phaseName(viewPhaseKey).toLowerCase()}</div>
          <p className="ora-hormoneline">{phase.hormone}</p>
          <ul className="ora-bullets">
            {phase.feel.slice(0, 2).map((f) => <li key={f}>{f}</li>)}
            {phase.body.slice(0, 2).map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="ora-card">
        <div className="ora-cardhead">{t("logTodayCard")}</div>
        <div className="ora-flowrow">
          {FLOWS.map((f, i) => (
            <button key={f.id} className={`ora-flowbtn${flows[todayISO] === f.id ? " on" : ""}`}
              onClick={() => setField("flows", todayISO, flows[todayISO] === f.id ? null : f.id)}>
              <Drops n={i + 1} />{f.label}
            </button>
          ))}
        </div>
        <button className="ora-widebtn" onClick={onLogToday}>
          {logged.length
            ? `${t("edit")} — ${logged.slice(0, 2).join(", ")}${logged.length > 2 ? "…" : ""}`
            : t("addMoodSymptoms")}
        </button>
        {method.daily && (
          <button className={`ora-pillbtn${bcLog[todayISO] ? " on" : ""}`}
            onClick={() => setField("bcLog", todayISO, bcLog[todayISO] ? null : true)}>
            <span className="ora-check">{bcLog[todayISO] ? "✓" : ""}</span>
            {bcLog[todayISO] ? `${method.label} taken` : `Take ${method.label.toLowerCase()}`}
          </button>
        )}
      </div>

      <div className="ora-avgstrip">
        <span><strong>{cycleLen}</strong>{t("dayCycleSuffix")}</span>
        <i />
        <span><strong>{periodLen}</strong> {t("periodWord").toLowerCase()}</span>
        {stats.spread !== null && <><i /><span>±{Math.ceil(stats.spread / 2)} {t("days")}</span></>}
      </div>

      <div className="ora-note">{t("hormoneNoteShort")}</div>
    </div>
  );
}

/* ------------------------------ the dial ------------------------------ *
 * A radial bar chart of the whole cycle. Angle = day, colour = phase,
 * bar height = how much hormonal activity that day carries. Days already
 * lived are solid; days ahead are held back. Drag to preview any day.
 * ------------------------------------------------------------------- */
const PHASE_COLOUR = {
  menstrual: "#c54b8c",
  follicular: "#eccddc",
  fertile: "#fb74a8",
  luteal: "#fdb9d1",
  late: "#f2a0c1",
};

function Dial({ cycleLen, periodLen, cycleDay, viewDay, hormones, flowForDay, onScrub }) {
  const [dragging, setDragging] = useState(false);
  const size = 260, c = 130;
  const rBand = 74, rBase = 86, rMax = 120;
  const step = (Math.PI * 2) / cycleLen;
  const mid = (day) => (day - 0.5) * step - Math.PI / 2;
  const ov = cycleLen - 13;
  const active = viewDay || cycleDay;

  const arc = (d1, d2, r) => {
    const a1 = (d1 - 1) * step - Math.PI / 2;
    const a2 = d2 * step - Math.PI / 2;
    const large = a2 - a1 > Math.PI ? 1 : 0;
    return `M${(c + Math.cos(a1) * r).toFixed(2)},${(c + Math.sin(a1) * r).toFixed(2)}` +
      `A${r},${r} 0 ${large} 1 ${(c + Math.cos(a2) * r).toFixed(2)},${(c + Math.sin(a2) * r).toFixed(2)}`;
  };

  const bars = [];
  for (let day = 1; day <= cycleLen; day++) {
    const ph = phaseFor(day, cycleLen, periodLen);
    const act = Math.max(0, Math.min(100,
      0.45 * hormones.e(day) + 0.45 * hormones.p(day) + 0.25 * hormones.lh(day)));
    const len = rBase + 7 + (act / 100) * (rMax - rBase - 7);
    const a = mid(day);
    const past = cycleDay && day <= cycleDay;
    bars.push(
      <line key={day} className="ora-tick"
        x1={(c + Math.cos(a) * rBase).toFixed(2)} y1={(c + Math.sin(a) * rBase).toFixed(2)}
        x2={(c + Math.cos(a) * len).toFixed(2)} y2={(c + Math.sin(a) * len).toFixed(2)}
        stroke={PHASE_COLOUR[ph]} strokeWidth={cycleLen > 33 ? 3 : 3.8} strokeLinecap="round"
        strokeOpacity={!cycleDay || past ? 1 : 0.4}
        style={{ animationDelay: `${day * 11}ms` }} />
    );
  }

  const dots = [];
  for (let day = 1; day <= periodLen; day++) {
    const flow = flowForDay ? flowForDay(day) : null;
    dots.push(
      <path key={day} d={arc(day, day, rBand)} fill="none" strokeLinecap="round"
        stroke="#c54b8c" strokeWidth={flow === "heavy" ? 6 : flow === "medium" ? 4.5 : 3.5}
        strokeOpacity={flow ? 1 : 0.28} strokeDasharray={flow ? "" : "1.5 3"} />
    );
  }

  const marker = (day, colour, r) => {
    const a = mid(day);
    return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r, colour };
  };
  const todayM = cycleDay ? marker(cycleDay, "#38202c", rMax + 9) : null;
  const viewM = viewDay && viewDay !== cycleDay ? marker(viewDay, "#fb74a8", rMax + 9) : null;
  const phaseNow = active ? phaseFor(active, cycleLen, periodLen) : null;

  const pick = (e) => {
    if (!onScrub || !cycleDay) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ang = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) + Math.PI / 2;
    let frac = ang / (Math.PI * 2);
    if (frac < 0) frac += 1;
    onScrub(Math.min(cycleLen, Math.floor(frac * cycleLen) + 1));
  };

  return (
    <div className="ora-dialwrap">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%"
        className={onScrub && cycleDay ? "ora-dialsvg live" : "ora-dialsvg"}
        role="img" aria-label={cycleDay ? `Cycle day ${cycleDay} of about ${cycleLen}` : "No cycle data yet"}
        onPointerDown={(e) => { setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => dragging && pick(e)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}>
        <circle cx={c} cy={c} r={rBand} fill="none" stroke="#f6e8ee" strokeWidth="3.5" />
        {dots}
        {ov - 5 >= 1 && (
          <path d={arc(ov - 5, Math.min(cycleLen, ov + 1), rBand)} fill="none"
            stroke="#fb74a8" strokeWidth="3.5" strokeOpacity="0.42" strokeLinecap="round" />
        )}
        {bars}
        {todayM && (
          <>
            <line x1={c + Math.cos(mid(cycleDay)) * (rBase - 9)} y1={c + Math.sin(mid(cycleDay)) * (rBase - 9)}
              x2={todayM.x} y2={todayM.y} stroke="#38202c" strokeWidth="1" strokeOpacity="0.28" />
            <circle cx={todayM.x} cy={todayM.y} r="4.5" fill="#38202c" />
          </>
        )}
        {viewM && (
          <>
            <line x1={c + Math.cos(mid(viewDay)) * (rBase - 9)} y1={c + Math.sin(mid(viewDay)) * (rBase - 9)}
              x2={viewM.x} y2={viewM.y} stroke="#fb74a8" strokeWidth="1" strokeOpacity="0.5" />
            <circle cx={viewM.x} cy={viewM.y} r="5.5" fill="#fdf7f9" stroke="#fb74a8" strokeWidth="2.5" />
          </>
        )}
        <text x={c} y="14" textAnchor="middle" className="ora-dialtick">DAY 1</text>
      </svg>

      <div className="ora-dial-centre">
        <div className="ora-dayword">{viewDay && viewDay !== cycleDay ? t("preview") : t("cycleDay")}</div>
        <div className="ora-daynum">{active || "–"}</div>
        {phaseNow && <div className="ora-dialphase"><i style={{ background: PHASE_COLOUR[phaseNow] }} />{phaseName(phaseNow)}</div>}
        {!phaseNow && <div className="ora-dialphase muted">Nothing logged</div>}
      </div>
    </div>
  );
}

/* --------------------------- hormone chart --------------------------- */
function HormoneChart({ hormones, cycleLen, cycleDay }) {
  const W = 320, H = 108, padB = 16;
  const x = (d) => ((d - 1) / (cycleLen - 1)) * W;
  const y = (v) => H - padB - (v / 100) * (H - padB - 6);
  const path = (fn) => {
    let s = "";
    for (let d = 1; d <= cycleLen; d += 0.5) s += `${s ? "L" : "M"}${x(d).toFixed(1)},${y(fn(d)).toFixed(1)}`;
    return s;
  };
  const area = (fn) => `${path(fn)}L${W},${H - padB}L0,${H - padB}Z`;

  return (
    <div className="ora-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ height: 112 }} aria-hidden="true">
        <line x1="0" y1={H - padB} x2={W} y2={H - padB} stroke="#f0dbe4" strokeWidth="1" />
        <path d={area(hormones.e)} fill="#fb74a8" opacity="0.13" />
        <path d={area(hormones.p)} fill="#c54b8c" opacity="0.11" />
        <path d={path(hormones.lh)} fill="none" stroke="#8d6b79" strokeWidth="1.4" opacity="0.55" strokeDasharray="3 3" />
        <path d={path(hormones.t)} fill="none" stroke="#d9a3ba" strokeWidth="1.4" />
        <path d={path(hormones.e)} fill="none" stroke="#fb74a8" strokeWidth="2.2" strokeLinejoin="round" />
        <path d={path(hormones.p)} fill="none" stroke="#c54b8c" strokeWidth="2.2" strokeLinejoin="round" />
        <line x1={x(cycleDay)} y1="2" x2={x(cycleDay)} y2={H - padB} stroke="#38202c" strokeWidth="1.2" />
        <circle cx={x(cycleDay)} cy={H - padB} r="3.5" fill="#38202c" />
      </svg>
      <div className="ora-chartaxis">
        <span>Day 1</span>
        <span style={{ opacity: 0.6 }}>Ovulation ~ day {hormones.ov}</span>
        <span>Day {cycleLen}</span>
      </div>
    </div>
  );
}

/* ============================== calendar ============================== */
function CalendarScreen(props) {
  const { calMode, setCalMode, cursor, setCursor, shiftMonth, grid, dayState, fertile,
    ovulation, todayISO, hasAnything, onPick, method, data, selected, setSelected,
    blocks, cycleLen, periodLen, show } = props;

  const timer = useRef(null);
  const held = useRef(false);
  const press = (onHold, onTap) => ({
    onPointerDown: () => {
      held.current = false;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { held.current = true; onHold(); }, 450);
    },
    onPointerUp: () => { clearTimeout(timer.current); if (!held.current) onTap(); },
    onPointerLeave: () => clearTimeout(timer.current),
    onPointerCancel: () => clearTimeout(timer.current),
    onContextMenu: (e) => e.preventDefault(),
  });
  const [selMonth, setSelMonth] = useState(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const openMonth = (m) => { setCursor({ year: cursor.year, month: m }); setCalMode("month"); setSelMonth(null); };

  return (
    <div>
      <div className="ora-segrow">
        <div className="ora-seg">
          <button className={`ora-segbtn${calMode === "month" ? " on" : ""}`} onClick={() => setCalMode("month")}>{t("month")}</button>
          <button className={`ora-segbtn${calMode === "year" ? " on" : ""}`} onClick={() => setCalMode("year")}>{t("year")}</button>
        </div>
      </div>

      {calMode === "month" ? (
        <>
          <div className="ora-calbar">
            <button className="ora-arrow" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <div className="ora-caltitle">{MONTHS[cursor.month]} {cursor.year}</div>
            <button className="ora-arrow" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="ora-dow">
            {(FMT.firstDay === 0 ? WEEKDAYS_SUN : WEEKDAYS_MON).map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="ora-grid">
            {grid.map((date, i) => {
              if (!date) return <div key={i} className="ora-cell empty" />;
              const st = dayState(date);
              const cls = ["ora-cell"];
              if (["light","medium","heavy","predicted"].indexOf(st) > -1) cls.push(st);
              if (date === todayISO) cls.push("today");
              if (date > todayISO && !st) cls.push("dim");
              if (date === selected) cls.push("picked");
              return (
                <button key={i} className={cls.join(" ")}
                  {...press(() => onPick(date), () => setSelected(selected === date ? null : date))}>
                  {fromISO(date).getDate()}
                  {!st && ovulation.has(date) && <span className="ora-pip ovulation" />}
                  {!st && !ovulation.has(date) && fertile.has(date) && <span className="ora-pip fertile" />}
                  {hasAnything(date) && <span className="ora-note-dot" />}
                </button>
              );
            })}
          </div>
          <div className="ora-legend">
            <span className="ora-leg"><i className="ora-swatch" style={{ background: "#c54b8c" }} />{t("loggedPeriod")}</span>
            <span className="ora-leg"><i className="ora-swatch" style={{ border: "1.5px dashed #fb74a8" }} />{t("predicted")}</span>
            {!method.hormonal && show.fertility && <span className="ora-leg"><i className="ora-swatch" style={{ background: "#fb74a8", opacity: 0.5, width: 8, height: 8 }} />{t("fertileWindow")}</span>}
            {!method.hormonal && show.fertility && <span className="ora-leg"><i className="ora-swatch" style={{ border: "1.5px solid #fb74a8", width: 9, height: 9 }} />{t("ovulation")}</span>}
            <span className="ora-leg"><i className="ora-swatch" style={{ background: "#38202c", width: 5, height: 5 }} />{t("notesSymptoms")}</span>
          </div>

          {selected ? (
            <DayPeek date={selected} data={data} blocks={blocks} cycleLen={cycleLen}
              periodLen={periodLen} onEdit={() => onPick(selected)} onClose={() => setSelected(null)} />
          ) : (
            <div className="ora-hint">{t("tapDayHint")}</div>
          )}
        </>
      ) : (
        <>
          <div className="ora-calbar">
            <button className="ora-arrow" onClick={() => setCursor((c) => ({ ...c, year: c.year - 1 }))} aria-label="Previous year">‹</button>
            <div className="ora-caltitle">{cursor.year}</div>
            <button className="ora-arrow" onClick={() => setCursor((c) => ({ ...c, year: c.year + 1 }))} aria-label="Next year">›</button>
          </div>
          <div className="ora-year">
            {MONTHS.map((name, m) => {
              const cells = monthGrid(cursor.year, m);
              const now = new Date();
              const isNow = m === now.getMonth() && cursor.year === now.getFullYear();
              return (
                <button key={m} className={`ora-mini${isNow ? " now" : ""}${selMonth === m ? " picked" : ""}`}
                  {...press(() => openMonth(m), () => setSelMonth(selMonth === m ? null : m))}>
                  <div className="ora-mininame">{MONTHS_SHORT[m]}</div>
                  <div className="ora-minigrid">
                    {cells.map((date, i) => {
                      if (!date) return <span key={i} className="ora-minicell blank" />;
                      const st = dayState(date);
                      const c = ["ora-minicell"];
                      if (["light","medium","heavy","predicted"].indexOf(st) > -1) c.push(st);
                      return <span key={i} className={c.join(" ")} />;
                    })}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="ora-legend">
            <span className="ora-leg"><i className="ora-swatch" style={{ background: "#c54b8c" }} />{t("loggedPeriod")}</span>
            <span className="ora-leg"><i className="ora-swatch" style={{ background: "#f4e0e8" }} />{t("predicted")}</span>
          </div>

          {selMonth !== null ? (
            <MonthPeek year={cursor.year} month={selMonth} data={data} dayState={dayState}
              onOpen={() => openMonth(selMonth)} onClose={() => setSelMonth(null)} />
          ) : (
            <div className="ora-hint">{t("tapMonthHint")}</div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================== insights ============================== */
function InsightsScreen({ patterns, tuning, stats, blocks, loggedDays, data, show, todayISO }) {
  const [openCycle, setOpenCycle] = useState(null);
  const [allCycles, setAllCycles] = useState(false);
  const reversed = [...blocks].reverse();
  const history = allCycles ? reversed : reversed.slice(0, 3);
  const nothingYet = PHASE_ORDER.every((k) => !patterns[k].ranked.length);

  const counts = {};
  if (show.symptoms) Object.keys(data.symptoms).forEach((d) => (data.symptoms[d] || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  if (show.mood) Object.keys(data.moods).forEach((d) => (data.moods[d] || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  const top = Object.keys(counts).map((tag) => ({ tag, n: counts[tag] })).sort((a, b) => b.n - a.n).slice(0, 10);
  const most = top.length ? top[0].n : 1;

  return (
    <div>
      <div className="ora-tune tall">
        <div className="ora-tunehead">
          <span>{tuning.label}</span>
          <span>{loggedDays} {loggedDays === 1 ? "day" : "days"} logged</span>
        </div>
        <div className="ora-tunebar">{[0,1,2,3].map((i) => <span key={i} className={i <= tuning.level ? "on" : ""} />)}</div>
        <div className="ora-tunenote">{tuning.note}</div>
      </div>

      <h2 className="ora-h2">{t("yourPatterns")}</h2>
      <p className="ora-lead">
        What you actually log, grouped by where it landed in your cycle. Anything that has turned up
        in two or more separate cycles shows here.
      </p>
      {nothingYet ? (
        <div className="ora-card">
          <div className="ora-learnnote">
            Nothing repeating yet. Log moods and symptoms on the days you notice them — the same thing
            has to appear in two separate cycles before Celeste will claim it as a pattern.
          </div>
        </div>
      ) : (
        PHASE_ORDER.filter((k) => patterns[k].ranked.length).map((k) => (
          <div className="ora-card" key={k}>
            <div className="ora-cardhead">{phaseName(k)}</div>
            <ul className="ora-bullets mine">
              {patterns[k].ranked.map((r) => (
                <li key={r.tag}>
                  <strong>{r.tag}</strong> — {r.count} of {patterns[k].total} {patterns[k].total === 1 ? "cycle" : "cycles"}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {top.length > 0 && (
        <>
          <h2 className="ora-h2">{t("mostLogged")}</h2>
          <p className="ora-lead">Everything you have recorded, counted across every cycle.</p>
          <div className="ora-card">
            {top.map((t) => (
              <div className="ora-freqrow" key={t.tag}>
                <span className="ora-freqname">{t.tag}</span>
                <span className="ora-freqbar"><i style={{ width: `${(t.n / most) * 100}%` }} /></span>
                <span className="ora-freqn">{t.n}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="ora-h2">{t("cycleHistory")}</h2>
      {blocks.length === 0 ? (
        <div className="ora-card"><div className="ora-learnnote">{t("noPeriodsYet")}</div></div>
      ) : (
        <div className="ora-card ora-hist">
          {history.map((b) => {
            const len = diffISO(b.start, b.end) + 1;
            const idx = blocks.indexOf(b);
            const next = blocks[idx + 1];
            const cyc = next ? diffISO(b.start, next.start) : null;
            const until = next ? next.start : addISO(todayISO, 1);
            const days = loggedDates(data).filter((d) => d >= b.start && d < until);
            const isOpen = openCycle === b.start;
            return (
              <div className="ora-cyclewrap" key={b.start}>
                <button className="ora-cyclerow" onClick={() => setOpenCycle(isOpen ? null : b.start)}
                  aria-expanded={isOpen}>
                  <span className="ora-logmain">
                    <span className="ora-histdate">{longDate(b.start)}</span>
                    <span className="ora-histsub">
                      {len} {len === 1 ? t("day") : t("days")} {t("daysBleeding")}
                      {days.length ? ` · ${days.length} ${t("logged")}` : ""}
                    </span>
                  </span>
                  <span className="ora-histlen">{cyc ? `${cyc}${t("dayCycleSuffix")}` : t("current")}</span>
                  <span className="ora-chev">{isOpen ? "–" : "+"}</span>
                </button>

                {isOpen && (
                  <div className="ora-cycledays">
                    {days.length === 0 ? (
                      <div className="ora-peekempty">Nothing logged during this cycle.</div>
                    ) : days.map((d) => {
                      const rows = summarise(d, data)
                        .filter((r) => (show.symptoms || r.k !== "Symptoms") && (show.mood || r.k !== "Mood"));
                      return (
                        <div className="ora-cycleday" key={d}>
                          <div className="ora-cycledaytop">
                            <span className="ora-histdate">Day {diffISO(b.start, d) + 1}</span>
                            <span className="ora-histsub">{prettyDate(d)}</span>
                          </div>
                          {rows.length === 0 && !data.notes[d] ? (
                            <div className="ora-histsub">Note only</div>
                          ) : (
                            <div className="ora-pills">
                              {rows.map((r) => (
                                <span className={`ora-pill flat${r.strong ? " hot" : ""}`} key={r.k}>{r.v}</span>
                              ))}
                            </div>
                          )}
                          {data.notes[d] && <div className="ora-peeknote">{data.notes[d]}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {blocks.length > 3 && (
            <button className="ora-showall" onClick={() => setAllCycles(!allCycles)}>
              {allCycles ? t("showFewer") : `${t("showOlder")} (${blocks.length - 3})`}
            </button>
          )}
        </div>
      )}

      <div className="ora-note">
        Pain that stops your day, bleeding that soaks through hourly, or a mood dip that does not lift
        are all worth taking to a clinician rather than an app.
      </div>
    </div>
  );
}

/* ================================= you ================================= */
const YOU_TILES = [
  { id: "cycle", labelKey: "periodCycle", Icon: TileDrop, tint: "#fce4ee" },
  { id: "hormones", labelKey: "hormonesPhases", Icon: TileWave, tint: "#f8e2ec" },
  { id: "notes", labelKey: "notes", Icon: TileNote, tint: "#fce7f0" },
  { id: "bc", labelKey: "birthControl", Icon: TilePill, tint: "#fae3ec" },
  { id: "logs", labelKey: "pastLogs", Icon: TileList, tint: "#fbe6f0" },
  { id: "data", labelKey: "dataPrivacy", Icon: TileLock, tint: "#f7e3ea" },
];

function YouScreen(props) {
  const { settings, setSetting, setSub, setSub2, method, stats, blocks, setData, data, onOpenDay,
    todayISO, hormones, patterns, cycleDay, phaseKey } = props;
  const [page, setPage] = useState(null);

  const shared = { settings, setSetting, method, stats, blocks, setData, data, onOpenDay,
    todayISO, hormones, patterns, phaseKey, cycleDay, back: () => setPage(null) };

  if (page === "cycle") return <SubPage title={t("cycleAnalysis")} back={shared.back} onAdd={() => onOpenDay(todayISO)}><CycleAnalysis {...shared} /></SubPage>;
  if (page === "hormones") return <SubPage title={t("hormonesPhases")} back={shared.back}><HormonesPage {...shared} /></SubPage>;
  if (page === "notes") return <SubPage title={t("notes")} back={shared.back}><NotesPage {...shared} /></SubPage>;
  if (page === "profile") return <SubPage title={t("yourProfile")} back={shared.back}><ProfilePage data={data} setData={setData} /></SubPage>;
  if (page === "partner") return <SubPage title={t("partnerMode")} back={shared.back}><PartnerPage {...shared} setSub={setSub} setSub2={setSub2} /></SubPage>;
  if (page === "bc") return <SubPage title={t("birthControl")} back={shared.back}><BirthControlPage {...shared} /></SubPage>;
  if (page === "data") return <SubPage title={t("dataPrivacy")} back={shared.back}><DataPage {...shared} /></SubPage>;
  if (page === "reminders") return <SubPage title={t("reminders")} back={shared.back}><RemindersPage {...shared} /></SubPage>;
  if (page === "logs") return <SubPage title={t("pastLogs")} back={shared.back}><PastLogs data={data} blocks={blocks} onOpenDay={onOpenDay} todayISO={todayISO} /></SubPage>;
  if (page === "export") return <SubPage title={t("exportWord")} back={shared.back}><ExportPage {...shared} /></SubPage>;
  if (page === "about") return <SubPage title={t("about")} back={shared.back}><AboutPage {...shared} /></SubPage>;

  const phase = phaseKey ? PHASES[phaseKey] : null;

  return (
    <div>
      <div className="ora-hero">
        <button className="ora-heromain" onClick={() => setPage("profile")}>
          <Avatar profile={data.profile} size={58} badge={cycleDay || null} />
          <span className="ora-herotext">
            <span className="ora-heroname">
              {(data.profile && data.profile.name) ? data.profile.name : t("addYourName")}
            </span>
            <span className="ora-herosub">
              {phaseKey ? `${phaseName(phaseKey)} ${t("phase")}` : t("noCycleYet")}
              {blocks.length ? ` · ${stats.cycleLen}-day average` : ""}
            </span>
          </span>
          <span className="ora-chev">›</span>
        </button>

        <div className="ora-quickgrid">
          {[
            { id: "reminders", label: t("reminders"), Icon: TileBell },
            { id: "partner", label: t("partner"), Icon: TileHeart },
            { id: "export", label: t("exportWord"), Icon: TileSpark },
            { id: "about", label: t("about"), Icon: TileInfo },
          ].map((q) => (
            <button key={q.id} className="ora-quick" onClick={() => setPage(q.id)}>
              <span className="ora-quickicon"><q.Icon /></span>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ora-tilecard">
        <div className="ora-tilegrid">
          {YOU_TILES.map((tile) => (
            <button key={tile.id} className="ora-tile" onClick={() => setPage(tile.id)}>
              <span className="ora-tileicon" style={{ background: tile.tint }}><tile.Icon /></span>
              <span className="ora-tilelabel">{t(tile.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ora-note">
        Everything you log stays on this device. Celeste is a tracker, not a diagnosis.
      </div>
    </div>
  );
}

function SubPage({ title, back, onAdd, children }) {
  return (
    <div className="ora-sub-page">
      <div className="ora-pagehead">
        <button className="ora-arrow" onClick={back} aria-label="Back">‹</button>
        <div className="ora-pagetitle">{title}</div>
        {onAdd ? <button className="ora-add" onClick={onAdd} aria-label="Log today">+</button> : <span className="ora-arrow ghost" />}
      </div>
      {children}
    </div>
  );
}

/* --------------------------- cycle analysis --------------------------- */
function CycleAnalysis({ blocks, stats, todayISO, onOpenDay }) {
  const [tab, setTab] = useState("history");
  const [limit, setLimit] = useState(6);

  const cycles = blocks.map((b, i) => {
    const next = blocks[i + 1];
    return {
      start: b.start, end: b.end,
      period: diffISO(b.start, b.end) + 1,
      cycle: next ? diffISO(b.start, next.start) : null,
    };
  });
  const rev = [...cycles].reverse();
  const current = rev[0];
  const prev = rev[1];

  if (!current) {
    return <div className="ora-card"><div className="ora-learnnote">
      No periods logged yet. Once you have recorded two, this page fills with your own numbers.
    </div></div>;
  }

  const runningCycle = diffISO(current.start, todayISO) + 1;
  const thisCycle = current.cycle || runningCycle;
  const periodVar = prev ? current.period - prev.period : null;
  const cycleVar = prev && prev.cycle ? thisCycle - prev.cycle : null;
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

  const trend = rev.slice(0, 6).reverse();
  const completed = cycles.filter((c) => c.cycle);
  const odd = completed.filter((c) => c.cycle < 21 || c.cycle > 35).length;

  const upcoming = [];
  for (let i = 1; i <= 6; i++) {
    const st = addISO(current.start, i * stats.cycleLen);
    upcoming.push({ start: st, end: addISO(st, stats.periodLen - 1) });
  }
  const shown = tab === "history" ? rev.slice(0, limit) : upcoming;
  const maxBar = Math.max(35, ...completed.map((c) => c.cycle));

  return (
    <div>
      <div className="ora-swipe">
        <div className="ora-statcard rose">
          <div className="ora-statcardtitle">Period length</div>
          <div className="ora-statcardvar">
            {periodVar === null ? "First one logged" : `Variation: ${periodVar === 0 ? "0 days" : `${sign(periodVar)} days`}`}
          </div>
          <div className="ora-statline"><span>Last period</span><strong>{prev ? prev.period : "—"}</strong></div>
          <div className="ora-statline filled"><span>This period</span><strong>{current.period}</strong></div>
          <p className="ora-statcardnote">
            {periodVar === null ? "Log another and Celeste will start comparing."
              : periodVar === 0 ? "This period lasted the same as last time."
              : `${Math.abs(periodVar)} ${Math.abs(periodVar) === 1 ? "day" : "days"} ${periodVar > 0 ? "longer" : "shorter"} than last time. Small shifts are normal.`}
          </p>
        </div>

        <div className="ora-statcard pink">
          <div className="ora-statcardtitle">Cycle length</div>
          <div className="ora-statcardvar">
            {cycleVar === null ? "Not enough cycles yet" : `Variation: ${cycleVar === 0 ? "0 days" : `${sign(cycleVar)} days`}`}
          </div>
          <div className="ora-statline"><span>Last cycle</span><strong>{prev && prev.cycle ? prev.cycle : "—"}</strong></div>
          <div className="ora-statline filled dark">
            <span>This cycle</span><strong>{thisCycle}{current.cycle ? "" : "*"}</strong>
          </div>
          <p className="ora-statcardnote">
            {current.cycle ? "" : "* still running. "}
            {cycleVar === null ? "Two completed cycles are needed before this compares."
              : Math.abs(cycleVar) <= 3 ? "Well within normal week-to-week movement."
              : "Stress, sleep and illness all move cycle length around."}
          </p>
        </div>
      </div>

      <div className="ora-card">
        <div className="ora-trendhead">
          <div>
            <div className="ora-trendtitle">Cycle trends</div>
            <div className="ora-histsub">Based on your last {trend.length} {trend.length === 1 ? "cycle" : "cycles"}</div>
          </div>
        </div>
        <div className="ora-trendtiles">
          <div className="ora-trendtile blue">
            <span>Average cycle</span>
            <strong>{stats.cycleLen} days</strong>
          </div>
          <div className="ora-trendtile pinkt">
            <span>Average period</span>
            <strong>{stats.periodLen} days</strong>
          </div>
        </div>
        <TrendChart points={trend} />
        {odd > 0 ? (
          <p className="ora-body" style={{ marginTop: 14 }}>
            {odd} {odd === 1 ? "cycle sits" : "cycles sit"} outside the typical 21 to 35 days. One odd cycle
            is common; a run of them is worth mentioning to a clinician, especially alongside pain or heavy bleeding.
          </p>
        ) : (
          <p className="ora-body" style={{ marginTop: 14 }}>
            Every cycle you have logged falls inside the typical 21 to 35 day range.
          </p>
        )}
      </div>

      <div className="ora-card">
        <div className="ora-trendtitle">Period</div>
        <div className="ora-histsub" style={{ marginBottom: 12 }}>
          {cycles.length} {cycles.length === 1 ? "cycle" : "cycles"} logged
        </div>
        <div className="ora-pilltabs">
          <button className={`ora-pilltab${tab === "history" ? " on" : ""}`} onClick={() => setTab("history")}>History</button>
          <button className={`ora-pilltab${tab === "predictions" ? " on" : ""}`} onClick={() => setTab("predictions")}>Predictions</button>
        </div>

        {shown.map((c, i) => (
          <div className="ora-barrow" key={c.start}>
            <div className="ora-barlabel">{spanLabel(c.start, c.end)}</div>
            <div className="ora-bartrack">
              <span className="ora-barperiod" style={{ width: `${((tab === "history" ? c.period : stats.periodLen) / maxBar) * 100}%` }}>
                {tab === "history" ? c.period : stats.periodLen}
              </span>
              {tab === "history" && c.cycle && (
                <span className="ora-barcycle" style={{ width: `${(c.cycle / maxBar) * 100}%` }}>{c.cycle}</span>
              )}
              {tab === "predictions" && (
                <span className="ora-barcycle ghost" style={{ width: `${(stats.cycleLen / maxBar) * 100}%` }}>{stats.cycleLen}</span>
              )}
              {tab === "history" && !c.cycle && <span className="ora-barnow">running</span>}
            </div>
            {tab === "history" && (
              <button className="ora-edit" onClick={() => onOpenDay(c.start)} aria-label="Edit this period">
                <PencilIcon />
              </button>
            )}
          </div>
        ))}

        {tab === "history" && rev.length > limit && (
          <button className="ora-showall" onClick={() => setLimit(limit + 6)}>More</button>
        )}
        {tab === "predictions" && (
          <div className="ora-learnnote" style={{ marginTop: 12 }}>
            Projected from your {stats.cycleLen}-day average. Each cycle you log nudges these dates.
          </div>
        )}
      </div>
    </div>
  );
}

function TrendChart({ points }) {
  const W = 300, H = 150, padL = 22, padB = 26, padT = 8;
  if (points.length === 0) return null;
  const max = 45;
  const x = (i) => padL + (points.length === 1 ? (W - padL) / 2 : (i / (points.length - 1)) * (W - padL - 6));
  const y = (v) => padT + (1 - v / max) * (H - padB - padT);
  const line = (key) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key] || 0).toFixed(1)}`).join("");
  const cyclePath = points.map((p, i) => ({ p, i })).filter((o) => o.p.cycle)
    .map((o, k) => `${k ? "L" : "M"}${x(o.i).toFixed(1)},${y(o.p.cycle).toFixed(1)}`).join("");
  const cycled = points.filter((p) => p.cycle);

  return (
    <div className="ora-trendchart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 150 }} aria-hidden="true">
        {[10, 20, 30, 40].map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W} y2={y(v)} stroke="#f2e2ea" strokeWidth="1" />
            <text x="0" y={y(v) + 3} className="ora-axis">{v}</text>
          </g>
        ))}
        {cycled.length > 1 && <path d={cyclePath} fill="none" stroke="#c54b8c" strokeWidth="2" strokeLinejoin="round" />}
        <path d={line("period")} fill="none" stroke="#fb74a8" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.start}>
            {p.cycle && <circle cx={x(i)} cy={y(p.cycle)} r="3.5" fill="#fff" stroke="#c54b8c" strokeWidth="2" />}
            <circle cx={x(i)} cy={y(p.period)} r="3.5" fill="#fff" stroke="#fb74a8" strokeWidth="2" />
            <text x={x(i)} y={H - 8} textAnchor="middle" className="ora-axis">
              {MONTHS_SHORT[fromISO(p.start).getMonth()]} {fromISO(p.start).getDate()}
            </text>
          </g>
        ))}
      </svg>
      <div className="ora-legend" style={{ marginTop: 4 }}>
        <span className="ora-leg"><i className="ora-swatch" style={{ background: "#c54b8c" }} />Cycle length</span>
        <span className="ora-leg"><i className="ora-swatch" style={{ background: "#fb74a8" }} />Period length</span>
      </div>
    </div>
  );
}

/* ------------------------- other you sub-pages ------------------------- */
function HormonesPage({ hormones, stats, method, phaseKey }) {
  const [open, setOpen] = useState(phaseKey || "menstrual");
  return (
    <div>
      <div className="ora-card">
        <div className="ora-cardhead">Your modelled cycle</div>
        <HormoneChart hormones={hormones} cycleLen={stats.cycleLen} cycleDay={1} />
        <div className="ora-flag" style={{ marginTop: 10 }}>
          Shaped to your {stats.cycleLen}-day average. These are estimates from timing, never measurements.
          {method.hormonal ? ` Flattened because you are on the ${method.label.toLowerCase()}.` : ""}
        </div>
      </div>

      <h2 className="ora-h2">The phases</h2>
      <p className="ora-lead">
        {method.hormonal
          ? `You are on the ${method.label.toLowerCase()}, which flattens most of this. It is still worth knowing what your body would otherwise be doing.`
          : "What each hormone is doing across the month, and what that tends to feel like."}
      </p>
      {PHASE_ORDER.map((k) => {
        const ph = PHASES[k];
        const isOpen = open === k;
        return (
          <div className={`ora-acc${isOpen ? " open" : ""}${phaseKey === k ? " current" : ""}`} key={k}>
            <button className="ora-acchead" onClick={() => setOpen(isOpen ? null : k)}>
              <span>
                <span className="ora-accname">{phaseName(k)}{phaseKey === k && <em> · you're here</em>}</span>
                <span className="ora-acctag">{phaseTag(k)}</span>
              </span>
              <span className="ora-chev">{isOpen ? "–" : "+"}</span>
            </button>
            {isOpen && (
              <div className="ora-accbody">
                <p className="ora-hormoneline">{ph.hormone}</p>
                <div className="ora-sublab">In your body</div>
                <ul className="ora-bullets">{ph.body.map((b) => <li key={b}>{b}</li>)}</ul>
                <div className="ora-sublab">How it can feel</div>
                <ul className="ora-bullets">{ph.feel.map((b) => <li key={b}>{b}</li>)}</ul>
                <div className="ora-sublab">What tends to help</div>
                <ul className="ora-bullets">{ph.care.map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
            )}
          </div>
        );
      })}

      <h2 className="ora-h2">The hormones</h2>
      {HORMONES.map((h) => (
        <div className="ora-card" key={h.id}>
          <div className="ora-hname big"><i style={{ background: h.colour }} />{h.name}</div>
          <p className="ora-body">{h.what}</p>
          <div className="ora-sublab">When it is high</div>
          <p className="ora-body">{h.high}</p>
          <div className="ora-sublab">When it is low</div>
          <p className="ora-body">{h.low}</p>
        </div>
      ))}

      <div className="ora-note">
        General description of the menstrual cycle, not a reading of your body. Your own recurring
        patterns live in the Insights tab.
      </div>
    </div>
  );
}

function NotesPage({ data, onOpenDay }) {
  const dates = Object.keys(data.notes).filter((d) => data.notes[d]).sort().reverse();
  if (!dates.length) {
    return <div className="ora-card"><div className="ora-learnnote">No notes yet. Add one from any day in the log.</div></div>;
  }
  return (
    <div>
      <p className="ora-lead">{dates.length} {dates.length === 1 ? "note" : "notes"}, newest first.</p>
      {dates.map((d) => (
        <button className="ora-card ora-notecard" key={d} onClick={() => onOpenDay(d)}>
          <div className="ora-histdate">{prettyDate(d)}</div>
          <p className="ora-body" style={{ marginTop: 6 }}>{data.notes[d]}</p>
        </button>
      ))}
    </div>
  );
}

function BirthControlPage({ settings, setSetting, method, data }) {
  const taken = Object.keys(data.bcLog).length;
  return (
    <div>
      <div className="ora-card">
        <div className="ora-cardhead">Method</div>
        <div className="ora-chips">
          {BC_METHODS.map((m) => (
            <button key={m.id} className={`ora-chip${settings.bcMethod === m.id ? " on" : ""}`}
              onClick={() => setSetting("bcMethod", m.id)}>{m.label}</button>
          ))}
        </div>
        {method.daily && (
          <div className="ora-field">
            <label htmlFor="ora-time">Daily reminder</label>
            <input id="ora-time" type="time" value={settings.pillTime}
              onChange={(e) => setSetting("pillTime", e.target.value)} />
          </div>
        )}
      </div>
      {method.daily && (
        <div className="ora-card">
          <div className="ora-kv"><span>Days marked taken</span><strong>{taken}</strong></div>
          </div>
      )}
      {method.hormonal && (
        <div className="ora-card">
          <div className="ora-cardhead">What this changes</div>
          <ul className="ora-bullets">
            <li>Hormone curves are flattened — your own rise and fall is suppressed.</li>
            <li>The fertile window and ovulation markers are hidden, because a suppressed cycle does not ovulate on a predictable schedule.</li>
            <li>Any bleed is a withdrawal bleed rather than a true period, though logging it still tracks your pattern.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function RemindersPage({ settings, setSetting, method }) {
  return (
    <div>
      <div className="ora-card">
        <div className="ora-field">
          <label htmlFor="ora-remind">Period is coming</label>
          <select id="ora-remind" value={String(settings.remindPeriod)}
            onChange={(e) => setSetting("remindPeriod", e.target.value === "off" ? "off" : Number(e.target.value))}>
            <option value="off">Off</option>
            <option value="0">On the day</option>
            <option value="1">1 day before</option>
            <option value="2">2 days before</option>
            <option value="3">3 days before</option>
            <option value="5">5 days before</option>
          </select>
        </div>
        <Toggle label="PMS window" sub="A heads-up for the four days before your period is due"
          on={settings.remindPms} set={(v) => setSetting("remindPms", v)} />
        <Toggle label="Ovulation"
          sub={method.hormonal ? "Unavailable on hormonal contraception" : "On the estimated day"}
          on={settings.remindOvulation && !method.hormonal} disabled={method.hormonal}
          set={(v) => setSetting("remindOvulation", v)} />
        {method.daily && (
          <Toggle label="Contraception" sub={`If it is not logged by ${settings.pillTime}`}
            on={settings.remindPill} set={(v) => setSetting("remindPill", v)} />
        )}
        <div className="ora-learnnote">
          Reminders appear at the top of Today. Push notifications arrive when this runs as an installed app.
        </div>
      </div>
    </div>
  );
}

function buildCSV(data) {
  const dates = loggedDates(data);
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const rows = [["date", "flow", "moods", "symptoms", "skin & hair", "sex life", "mucus",
    "ovulation test", "pregnancy test", "breast exam", "contraception", "medicine",
    "weight kg", "temp C", "sleep hrs", "water", "note"].join(",")];
  dates.forEach((d) => {
    const g = (f) => (data[f] || {})[d];
    const list = (f) => (g(f) || []).join("; ");
    rows.push([
      d, g("flows") || "", list("moods"), list("symptoms"), list("skin"), list("sex"),
      g("discharge") || "", g("ovTest") || "", g("pregTest") || "", list("breast"),
      g("bcLog") ? "taken" : "", list("meds"), g("weight") || "", g("temp") || "",
      g("sleep") || "", g("water") || "", g("notes") || "",
    ].map(esc).join(","));
  });
  return rows.join("\n");
}

function ExportPage({ data }) {
  const csv = buildCSV(data);
  const [copied, setCopied] = useState(false);
  const lines = csv.split("\n").length - 1;

  const download = () => {
    try {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `celeste-export-${iso(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { console.error(err); }
  };
  const backup = () => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `celeste-backup-${iso(new Date())}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { console.error(err); }
  };
  const copy = () => {
    try {
      navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <p className="ora-lead">
        {lines} {lines === 1 ? "day" : "days"} of records as a spreadsheet file — one row per day, ready to
        open in Excel or hand to a clinician.
      </p>
      <div className="ora-card">
        <button className="ora-cta" onClick={download}>Download CSV</button>
        <button className="ora-widebtn" onClick={backup}>Download full backup (JSON)</button>
        <button className="ora-widebtn" onClick={copy}>{copied ? "Copied" : "Copy to clipboard"}</button>
        <div className="ora-learnnote">
          The backup holds everything, including settings, and can be read straight back in from
          Settings › Import data.
        </div>
      </div>
      <div className="ora-card">
        <div className="ora-cardhead">Preview</div>
        <pre className="ora-pre">{csv.split("\n").slice(0, 8).join("\n")}{lines > 7 ? "\n…" : ""}</pre>
      </div>
    </div>
  );
}

function DataPage({ setData, data }) {
  const [confirm, setConfirm] = useState(false);
  const days = loggedDates(data).length;

  return (
    <div>
      <div className="ora-card">
        <div className="ora-kv"><span>Days recorded</span><strong>{days}</strong></div>
        <div className="ora-kv"><span>Stored</span><strong>On this device only</strong></div>
        <div className="ora-kv"><span>Sent anywhere</span><strong>Never</strong></div>
      </div>

      <div className="ora-card">
        <div className="ora-cardhead">Erase</div>
        {!confirm ? (
          <button className="ora-danger" style={{ marginTop: 0 }} onClick={() => setConfirm(true)}>Erase all data</button>
        ) : (
          <>
            <div className="ora-flag" style={{ marginTop: 0 }}>
              This removes every logged day, note and setting. It cannot be undone.
            </div>
            <div className="ora-flowrow" style={{ marginTop: 12 }}>
              <button className="ora-widebtn" style={{ marginTop: 0 }} onClick={() => setConfirm(false)}>Keep it</button>
              <button className="ora-danger" style={{ marginTop: 0 }}
                onClick={() => { setData(BLANK); setConfirm(false); }}>Erase</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AboutPage({ stats, blocks }) {
  return (
    <div>
      <div className="ora-card">
        <div className="ora-mark" style={{ fontSize: 30 }}>cel<span>este</span></div>
        <p className="ora-body" style={{ marginTop: 10 }}>
          A period tracker that shows you the hormones behind what you are feeling, and gets more specific
          to you the more you log.
        </p>
      </div>
      <div className="ora-card">
        <div className="ora-kv"><span>Periods logged</span><strong>{blocks.length}</strong></div>
        <div className="ora-kv"><span>Average cycle</span><strong>{stats.cycleLen} days</strong></div>
        <div className="ora-kv"><span>Average period</span><strong>{stats.periodLen} days</strong></div>
      </div>
      <div className="ora-card">
        <div className="ora-cardhead">Worth knowing</div>
        <ul className="ora-bullets">
          <li>Hormone levels here are modelled from your cycle timing. They are not measurements.</li>
          <li>The fertile window is an estimate and is not a contraceptive method.</li>
          <li>Pain that stops your day, bleeding that soaks through hourly, or a mood dip that does not lift are all worth taking to a clinician rather than an app.</li>
        </ul>
      </div>
    </div>
  );
}

/* Every cycle you have logged: when it bled, for how long, and how long
   until the next one started. Expand a cycle to reach the days inside it. */
function spanLabel(a, b) {
  const d1 = fromISO(a), d2 = fromISO(b);
  if (a === b) return `${d1.getDate()} ${MONTHS_SHORT[d1.getMonth()]}`;
  if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear())
    return `${d1.getDate()}–${d2.getDate()} ${MONTHS_SHORT[d1.getMonth()]}`;
  return `${d1.getDate()} ${MONTHS_SHORT[d1.getMonth()]} – ${d2.getDate()} ${MONTHS_SHORT[d2.getMonth()]}`;
}

function PastLogs({ data, blocks, onOpenDay, todayISO }) {
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const allLogged = useMemo(() => {
    return loggedDates(data);
  }, [data]);

  const cycles = useMemo(() => {
    return blocks.map((b, i) => {
      const next = blocks[i + 1];
      const until = next ? next.start : addISO(todayISO, 1);
      return {
        start: b.start,
        end: b.end,
        bled: diffISO(b.start, b.end) + 1,
        cycleLen: next ? diffISO(b.start, next.start) : null,
        running: next ? null : diffISO(b.start, todayISO) + 1,
        days: allLogged.filter((d) => d >= b.start && d < until),
      };
    }).reverse();
  }, [blocks, allLogged, todayISO]);

  const loose = allLogged.filter((d) => !blocks.length || d < blocks[0].start).reverse();

  if (!cycles.length && !loose.length) {
    return <div className="ora-card"><div className="ora-learnnote">
      Nothing logged yet. Every cycle you record shows up here to review or change.
    </div></div>;
  }

  const shown = showAll ? cycles : cycles.slice(0, 6);

  return (
    <>
      <div className="ora-card ora-hist">
        {shown.map((c) => {
          const isOpen = open === c.start;
          return (
            <div className="ora-cyclewrap" key={c.start}>
              <button className="ora-cyclerow" onClick={() => setOpen(isOpen ? null : c.start)}>
                <span className="ora-logmain">
                  <span className="ora-histdate">{spanLabel(c.start, c.end)}</span>
                  <span className="ora-histsub">
                    {c.bled} {c.bled === 1 ? "day" : "days"} of bleeding
                    {c.days.length ? ` · ${c.days.length} logged` : ""}
                  </span>
                </span>
                <span className="ora-cyclelen">
                  {c.cycleLen ? <><strong>{c.cycleLen}</strong> days to next</> : <em>current · day {c.running}</em>}
                </span>
                <span className="ora-chev">{isOpen ? "–" : "+"}</span>
              </button>

              {isOpen && (
                <div className="ora-cycledays">
                  {c.days.length === 0 ? (
                    <div className="ora-peekempty">No individual days logged in this cycle.</div>
                  ) : c.days.map((d) => {
                    const rows = summarise(d, data);
                    const tags = rows.filter((r) => r.k !== "Flow").map((r) => r.v).join(" · ");
                    return (
                      <button className="ora-logrow" key={d} onClick={() => onOpenDay(d)}>
                        <span className="ora-logmain">
                          <span className="ora-histdate">Day {diffISO(c.start, d) + 1} · {prettyDate(d)}</span>
                          <span className="ora-histsub">{tags || (data.notes[d] ? "Note only" : "—")}</span>
                        </span>
                        {data.flows[d] && <span className={`ora-flowtag ${data.flows[d]}`}>{data.flows[d]}</span>}
                        <span className="ora-chev">›</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {cycles.length > 6 && (
          <button className="ora-showall" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show fewer" : `Show all ${cycles.length} cycles`}
          </button>
        )}
      </div>

      {loose.length > 0 && (
        <div className="ora-card ora-hist">
          <div className="ora-cardhead">Before your first logged period</div>
          {loose.map((d) => (
            <button className="ora-logrow" key={d} onClick={() => onOpenDay(d)}>
              <span className="ora-logmain">
                <span className="ora-histdate">{prettyDate(d)}</span>
                <span className="ora-histsub">
                  {summarise(d, data).map((r) => r.v).join(" · ") || "Note only"}
                </span>
              </span>
              <span className="ora-chev">›</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Toggle({ label, sub, on, set, disabled }) {
  return (
    <button className={`ora-toggle${on ? " on" : ""}${disabled ? " off" : ""}`}
      disabled={disabled} onClick={() => set(!on)}>
      <span>
        <span className="ora-togglelabel">{label}</span>
        <span className="ora-togglesub">{sub}</span>
      </span>
      <span className="ora-switch"><i /></span>
    </button>
  );
}

/* ====================== day editor / sheet / log tab ====================== */
function cycleDayFor(date, blocks) {
  let cd = null;
  const starts = blocks.map((b) => b.start);
  for (let i = 0; i < starts.length; i++) if (starts[i] <= date) cd = diffISO(starts[i], date) + 1;
  return cd;
}
function phaseLabelFor(date, blocks, cycleLen, periodLen) {
  const cd = cycleDayFor(date, blocks);
  const ph = cd && cd <= cycleLen + 10 ? phaseFor(cd, cycleLen, periodLen) : null;
  return ph ? `Cycle day ${cd} \u00b7 $${phaseName(ph).toLowerCase()} ${t("phase")}` : "Outside a tracked cycle";
}

/* Each card is one field. Pills wrap; long lists show a preview with More. */
const LOG_SECTIONS = [
  { id: "symptoms", titleKey: "symptoms", field: "symptoms", type: "multi", icon: "body", gate: "symptoms", preview: 8,
    items: ["Cramps","Headache","Bloating","Tender breasts","Lower back pain","Fatigue","Nausea","Acne",
            "Pelvic pain","Ovulation pain","Spotting","Cravings","Hunger","Constipation","Loose stools",
            "Insomnia","Night sweats","Hot flushes","Chills","Dizziness","Itchiness","Joint ache",
            "Unable to concentrate","Illness"] },
  { id: "moods", titleKey: "mood", field: "moods", type: "multi", icon: "face", gate: "mood", preview: 8,
    items: ["Calm","Content","Happy","Energised","Confident","Focused","Playful","In love",
            "Relaxed","Grateful","Hopeful","Foggy","Bored","Sleepy","Restless","Sensitive",
            "Irritable","Frustrated","Angry","Anxious","Stressed","Overwhelmed","Lonely","Insecure",
            "Tearful","Low","Numb"] },
  { id: "skin", titleKey: "skinHair", field: "skin", type: "multi", icon: "spark", preview: 6,
    items: ["Healthy glow","Breakout","Dry skin","Oily skin","Redness","Good hair day","Bad hair day","Oily hair","Hair loss"] },
  { id: "sex", titleKey: "sexLife", field: "sex", type: "multi", icon: "heart", gate: "sex",
    items: ["Didn't have","Protected sex","Unprotected sex","Solo","Orgasm","No orgasm","High drive","Low drive"] },
  { id: "discharge", titleKey: "cervicalMucus", field: "discharge", type: "single", icon: "drop",
    items: ["Dry","Sticky","Creamy","Watery","Egg white","Spotting"] },
  { id: "ovTest", titleKey: "ovulationTest", field: "ovTest", type: "single", icon: "test", gate: "fertility",
    items: ["Positive","Negative","Low","High"] },
  { id: "pregTest", titleKey: "pregnancyTest", field: "pregTest", type: "single", icon: "test", gate: "fertility",
    items: ["Positive","Faint line","Negative"] },
  { id: "breast", titleKey: "breastExam", field: "breast", type: "multi", icon: "target", preview: 4,
    items: ["Everything is fine","Lump","Pain","Engorgement","Dimple","Skin redness","Nipple discharge","Cracked nipples"] },
];

const LIFESTYLE = [
  { field: "weight", labelKey: "weight", unit: "kg", step: 0.1, icon: "scale" },
  { field: "temp", labelKey: "temperature", unit: "°C", step: 0.05, icon: "temp" },
  { field: "sleep", labelKey: "sleep", unit: "hrs", step: 0.5, icon: "moon" },
];

function PillIcon({ kind, on }) {
  const c = on ? "#fff" : "#c54b8c";
  const P = { fill: "none", stroke: c, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    drop: <path d="M12 4c2.6 3 5 5.6 5 8.2a5 5 0 0 1-10 0C7 9.6 9.4 7 12 4Z" {...P} />,
    heart: <path d="M12 19.5S4.5 15 4.5 10.2A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7.5 2.2c0 4.8-7.5 9.3-7.5 9.3Z" {...P} />,
    face: <><circle cx="12" cy="12" r="7.6" {...P} /><path d="M9 14.4a4 4 0 0 0 6 0" {...P} /><circle cx="9.5" cy="10" r="1" fill={c} /><circle cx="14.5" cy="10" r="1" fill={c} /></>,
    body: <><circle cx="12" cy="12" r="7.6" {...P} /><path d="M12 8.6v6.8M8.6 12h6.8" {...P} /></>,
    spark: <path d="M12 4.5 13.4 9 18 10.4 13.4 11.8 12 16.3 10.6 11.8 6 10.4 10.6 9 12 4.5Z" {...P} />,
    test: <><rect x="4.5" y="9" width="15" height="6" rx="3" {...P} /><path d="M9.5 11v2M12.5 11v2" {...P} /></>,
    target: <><circle cx="12" cy="12" r="7.6" {...P} /><circle cx="12" cy="12" r="2.4" fill={c} /></>,
    scale: <><rect x="4.5" y="5.5" width="15" height="13" rx="3.5" {...P} /><path d="M12 15V11l2.4-1.6" {...P} /></>,
    temp: <><path d="M14 13.3V6.4a2 2 0 1 0-4 0v6.9a4 4 0 1 0 4 0Z" {...P} /><circle cx="12" cy="16.4" r="1.6" fill={c} /></>,
    moon: <path d="M18.5 14.4A7 7 0 0 1 9.6 5.5a7.2 7.2 0 1 0 8.9 8.9Z" {...P} />,
    pill: <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-40 12 12)" {...P} /><path d="M9.6 14.4 14.4 9.6" {...P} /></>,
  };
  return <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">{paths[kind] || paths.body}</svg>;
}

function Pill({ label, icon, on, onClick }) {
  return (
    <button className={`ora-pill${on ? " on" : ""}`} onClick={onClick} aria-pressed={on}>
      <span className="ora-pillicon"><PillIcon kind={icon} on={on} /></span>
      {label}
    </button>
  );
}

/* Flow is the headline: bigger targets, its own card, always first. */
function FlowCard({ date, data, setField }) {
  const cur = data.flows[date] || null;
  const opts = [
    { id: null, label: t("flowNone"), n: 0 },
    { id: "light", label: t("flowLight"), n: 1 },
    { id: "medium", label: t("flowMedium"), n: 2 },
    { id: "heavy", label: t("flowHeavy"), n: 3 },
  ];
  return (
    <div className="ora-flowcard">
      <div className="ora-flowcardhead">
        <span className="ora-flowcardtitle">{t("flow")}</span>
        {cur && <button className="ora-clearlink" onClick={() => setField("flows", date, null)}>{t("clear")}</button>}
      </div>
      <div className="ora-flowgrid">
        {opts.map((o) => (
          <button key={o.label} className={`ora-flowtile${(cur || null) === o.id ? " on" : ""}`}
            onClick={() => setField("flows", date, o.id)}>
            <span className="ora-flowdrops">
              {o.n === 0 ? <span className="ora-nodrop" /> : [0, 1, 2].map((i) => (
                <span key={i} className={`ora-bigdrop${i < o.n ? " f" : ""}`} />
              ))}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ sec, date, data, setField, toggleIn }) {
  const [expanded, setExpanded] = useState(false);
  const chosen = sec.type === "multi" ? (data[sec.field] || {})[date] || [] : (data[sec.field] || {})[date];
  const isOn = (item) => (sec.type === "multi" ? chosen.indexOf(item) > -1 : chosen === item);
  const limit = sec.preview && !expanded ? sec.preview : sec.items.length;
  const visible = sec.items.filter((it, i) => i < limit || isOn(it));
  const count = sec.type === "multi" ? chosen.length : chosen ? 1 : 0;

  return (
    <div className="ora-logcard">
      <div className="ora-logcardhead">
        <span className="ora-logcardtitle">{t(sec.titleKey)}</span>
        {count > 0 && <span className="ora-logcount">{count}</span>}
      </div>
      <div className="ora-pills">
        {visible.map((item) => (
          <Pill key={item} label={item} icon={sec.icon} on={isOn(item)}
            onClick={() => (sec.type === "multi"
              ? toggleIn(sec.field, date, item)
              : setField(sec.field, date, isOn(item) ? null : item))} />
        ))}
      </div>
      {sec.preview && sec.items.length > sec.preview && (
        <button className="ora-morelink" onClick={() => setExpanded(!expanded)}>
          {expanded ? t("less") : t("more")}
        </button>
      )}
    </div>
  );
}

const CORE_SECTIONS = ["symptoms", "moods"];

function DayEditor({ date, data, method, setField, toggleIn, show }) {
  const S = show || { symptoms: true, mood: true, sex: false, fertility: true };
  const [showMore, setShowMore] = useState(false);
  /* A section stays visible if it already holds something for this day, so a
     selection can never hide behind the More button. */
  const hasValue = (sec) => {
    const v = (data[sec.field] || {})[date];
    return Array.isArray(v) ? v.length > 0 : !!v;
  };
  const available = LOG_SECTIONS.filter((sec) => !sec.gate || S[sec.gate]);
  const shown = available.filter((sec) => showMore || CORE_SECTIONS.indexOf(sec.id) > -1 || hasValue(sec));
  const extrasUsed = !!data.bcLog[date] || (data.meds[date] || []).length
    || ["weight", "temp", "sleep", "water"].some((f) => (data[f] || {})[date] !== undefined);
  const hiddenCount = available.length - shown.length + (showMore || extrasUsed ? 0 : 2);
  const meds = data.meds || {};
  const takenMeds = meds[date] || [];

  return (
    <>
      <FlowCard date={date} data={data} setField={setField} />

      {shown.map((sec) => (
        <SectionCard key={sec.id} sec={sec} date={date} data={data} setField={setField} toggleIn={toggleIn} />
      ))}

      {!showMore && hiddenCount > 0 && (
        <button className="ora-morecard" onClick={() => setShowMore(true)}>
          {t("moreToLog")} <span>+{hiddenCount}</span>
        </button>
      )}

      {(showMore || extrasUsed) && (
      <div className="ora-logcard">
        <div className="ora-logcardhead"><span className="ora-logcardtitle">{t("medicine")}</span></div>
        <div className="ora-pills">
          {method.id !== "none" && (
            <Pill label={method.label} icon="pill" on={!!data.bcLog[date]}
              onClick={() => setField("bcLog", date, data.bcLog[date] ? null : true)} />
          )}
          {MED_EXTRAS.map((m) => (
            <Pill key={m} label={m} icon="pill" on={takenMeds.indexOf(m) > -1}
              onClick={() => toggleIn("meds", date, m)} />
          ))}
        </div>
      </div>
      )}

      {(showMore || extrasUsed) && (
      <div className="ora-logcard">
        <div className="ora-logcardhead"><span className="ora-logcardtitle">{t("lifestyle")}</span></div>
        <div className="ora-lifegrid">
          {LIFESTYLE.map((l) => (
            <label className="ora-liferow" key={l.field}>
              <span className="ora-lifeicon"><PillIcon kind={l.icon} /></span>
              <span className="ora-lifelabel">{t(l.labelKey)}</span>
              <input type="number" inputMode="decimal" step={l.step} placeholder="–"
                value={(data[l.field] || {})[date] === undefined ? "" : (data[l.field] || {})[date]}
                onChange={(e) => setField(l.field, date, e.target.value === "" ? null : Number(e.target.value))} />
              <span className="ora-lifeunit">{l.unit}</span>
            </label>
          ))}
          <div className="ora-liferow">
            <span className="ora-lifeicon"><PillIcon kind="drop" /></span>
            <span className="ora-lifelabel">{t("water")}</span>
            <div className="ora-counter">
              <button onClick={() => setField("water", date, Math.max(0, (((data.water || {})[date]) || 0) - 1) || null)}>−</button>
              <span>{(data.water || {})[date] || 0}</span>
              <button onClick={() => setField("water", date, (((data.water || {})[date]) || 0) + 1)}>+</button>
            </div>
            <span className="ora-lifeunit">{t("glasses")}</span>
          </div>
        </div>
      </div>
      )}

      <div className="ora-logcard">
        <div className="ora-logcardhead"><span className="ora-logcardtitle">{t("note")}</span></div>
        <textarea className="ora-textarea" rows={3} placeholder={t("notePlaceholder")}
          value={data.notes[date] || ""} onChange={(e) => setField("notes", date, e.target.value)} />
      </div>

      {showMore && (
        <button className="ora-morecard" onClick={() => setShowMore(false)}>{t("less")}</button>
      )}
    </>
  );
}

function DaySheet({ date, close, data, method, setField, toggleIn, cycleLen, periodLen, blocks, show }) {
  return (
    <>
      <div className="ora-veil" onClick={close} />
      <div className="ora-sheet">
        <div className="ora-sheettop">
          <div>
            <div className="ora-sheettitle">{prettyDate(date)}</div>
            <div className="ora-sheetsub">{phaseLabelFor(date, blocks, cycleLen, periodLen)}</div>
          </div>
          <button className="ora-close" onClick={close} aria-label="Close">✕</button>
        </div>
        <div className="ora-sheetscroll">
          <DayEditor date={date} data={data} method={method} setField={setField} toggleIn={toggleIn} show={show} />
        </div>
        <button className="ora-cta" onClick={close}>{t("done")}</button>
      </div>
    </>
  );
}

/* --------------------------- what a day holds --------------------------- */
function summarise(date, data) {
  const out = [];
  const m = (f) => (data[f] || {})[date];
  if (m("flows")) out.push({ k: "Flow", v: FLOWS.filter((f) => f.id === m("flows"))[0].label, strong: true });
  if ((m("moods") || []).length) out.push({ k: "Mood", v: m("moods").join(", ") });
  if ((m("symptoms") || []).length) out.push({ k: "Symptoms", v: m("symptoms").join(", ") });
  if ((m("skin") || []).length) out.push({ k: "Skin & hair", v: m("skin").join(", ") });
  if ((m("sex") || []).length) out.push({ k: "Sex life", v: m("sex").join(", ") });
  if (m("discharge")) out.push({ k: "Mucus", v: m("discharge") });
  if (m("ovTest")) out.push({ k: "Ovulation test", v: m("ovTest") });
  if (m("pregTest")) out.push({ k: "Pregnancy test", v: m("pregTest") });
  if ((m("breast") || []).length) out.push({ k: "Breast exam", v: m("breast").join(", ") });
  if (m("bcLog")) out.push({ k: "Contraception", v: "Taken" });
  if ((m("meds") || []).length) out.push({ k: "Medicine", v: m("meds").join(", ") });
  if (m("weight")) out.push({ k: "Weight", v: `${m("weight")} kg` });
  if (m("temp")) out.push({ k: "Temperature", v: `${m("temp")} °C` });
  if (m("sleep")) out.push({ k: "Sleep", v: `${m("sleep")} hrs` });
  if (m("water")) out.push({ k: "Water", v: `${m("water")} glasses` });
  return out;
}

/* Consecutive runs of dates that pass a test, within one month */
function runsIn(dates, test) {
  const runs = [];
  dates.forEach((d) => {
    if (!test(d)) return;
    const last = runs[runs.length - 1];
    if (last && diffISO(last[last.length - 1], d) === 1) last.push(d);
    else runs.push([d]);
  });
  return runs;
}
const runLabel = (run) => {
  const a = fromISO(run[0]).getDate();
  const b = fromISO(run[run.length - 1]).getDate();
  return a === b ? `${a}` : `${a}–${b}`;
};

function MonthPeek({ year, month, data, dayState, onOpen, onClose }) {
  const dates = monthGrid(year, month).filter(Boolean);
  const bled = runsIn(dates, (d) => !!data.flows[d]);
  const due = runsIn(dates, (d) => dayState(d) === "predicted");
  const logged = new Set(loggedDates(data));
  const daysLogged = dates.filter((d) => logged.has(d)).length;
  const bledDays = bled.reduce((n, r) => n + r.length, 0);

  return (
    <div className="ora-peek">
      <div className="ora-peektop">
        <div>
          <div className="ora-peekdate">{MONTHS[month]} {year}</div>
          <div className="ora-peeksub">
            {bledDays ? `${bledDays} ${bledDays === 1 ? "day" : "days"} of bleeding` : "No period logged"}
          </div>
        </div>
        <button className="ora-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="ora-peekrows">
        {bled.length > 0 && (
          <div className="ora-peekrow">
            <span>Period</span>
            <strong className="hot">{bled.map((r) => `${runLabel(r)} ${MONTHS_SHORT[month]}`).join(", ")}</strong>
          </div>
        )}
        {due.length > 0 && (
          <div className="ora-peekrow">
            <span>Predicted</span>
            <strong>{due.map((r) => `${runLabel(r)} ${MONTHS_SHORT[month]}`).join(", ")}</strong>
          </div>
        )}
        <div className="ora-peekrow">
          <span>{t("daysLogged")}</span>
          <strong>{daysLogged || "None"}</strong>
        </div>
      </div>
      <button className="ora-peekedit" onClick={onOpen}>Open {MONTHS[month]}</button>
    </div>
  );
}

function DayPeek({ date, data, blocks, cycleLen, periodLen, onEdit, onClose }) {
  const rows = summarise(date, data);
  const note = data.notes[date];
  return (
    <div className="ora-peek">
      <div className="ora-peektop">
        <div>
          <div className="ora-peekdate">{prettyDate(date)}</div>
          <div className="ora-peeksub">{phaseLabelFor(date, blocks, cycleLen, periodLen)}</div>
        </div>
        <button className="ora-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {rows.length === 0 && !note ? (
        <div className="ora-peekempty">{t("nothingLogged")}</div>
      ) : (
        <div className="ora-peekrows">
          {rows.map((r) => (
            <div className="ora-peekrow" key={r.k}>
              <span>{r.k}</span>
              <strong className={r.strong ? "hot" : ""}>{r.v}</strong>
            </div>
          ))}
          {note && <div className="ora-peeknote">{note}</div>}
        </div>
      )}
      <button className="ora-peekedit" onClick={onEdit}>
        {rows.length || note ? t("editThisDay") : t("logThisDay")}
      </button>
    </div>
  );
}

/* ------------------------------- log tab ------------------------------- */
function WeekStrip({ date, setDate, todayISO, data }) {
  const d = fromISO(date);
  const offset = (d.getDay() - FMT.firstDay + 7) % 7;
  const weekStart = addISO(date, -offset);
  const days = Array.from({ length: 7 }).map((_, i) => addISO(weekStart, i));
  const letters = FMT.firstDay === 0 ? WEEKDAYS_SUN : WEEKDAYS_MON;

  return (
    <div className="ora-weekwrap">
      <div className="ora-weekbar">
        <button className="ora-arrow small" onClick={() => setDate(addISO(date, -7))} aria-label="Previous week">‹</button>
        <div className="ora-weekmonth">{MONTHS[fromISO(date).getMonth()]}</div>
        <button className="ora-arrow small" onClick={() => setDate(addISO(date, 7))} aria-label="Next week">›</button>
      </div>
      <div className="ora-week">
        {days.map((dd, i) => {
          const isToday = dd === todayISO;
          const on = dd === date;
          const logged = summarise(dd, data).length > 0 || data.notes[dd];
          return (
            <button key={dd} className={`ora-weekday${on ? " on" : ""}`} onClick={() => setDate(dd)}>
              <span className="ora-weekletter">{isToday ? "TODAY" : letters[i]}</span>
              <span className="ora-weeknum">{fromISO(dd).getDate()}</span>
              <span className={`ora-weekdot${logged ? " has" : ""}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogSheet({ close, data, setField, toggleIn, method, todayISO, blocks, cycleLen, periodLen, show }) {
  const [date, setDate] = useState(todayISO);
  const isFuture = date > todayISO;

  return (
    <>
      <div className="ora-veil" onClick={close} />
      <div className="ora-sheet tall">
        <div className="ora-sheettop">
          <div style={{ flex: 1 }}>
            <div className="ora-sheettitle">{t("log")}</div>
            <div className="ora-sheetsub">{phaseLabelFor(date, blocks, cycleLen, periodLen)}</div>
          </div>
          <button className="ora-close" onClick={close} aria-label={t("close")}>✕</button>
        </div>

        <WeekStrip date={date} setDate={setDate} todayISO={todayISO} data={data} />

        <div className="ora-sheetscroll">
          {isFuture && <div className="ora-hint left">A future date — you can note plans, but it will not feed predictions.</div>}
          <DayEditor date={date} data={data} method={method} setField={setField} toggleIn={toggleIn} show={show} />
        </div>

        <button className="ora-cta" onClick={close}>{t("done")}</button>
      </div>
    </>
  );
}

/* ================================= profile ================================ */
function FlowerMark({ size }) {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      {petals.map((a, i) => (
        <ellipse key={a} cx="50" cy="30" rx="12.5" ry="19"
          fill={i % 2 ? "#fb74a8" : "#c54b8c"} opacity={i % 2 ? 0.75 : 0.62}
          transform={`rotate(${a} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="9.5" fill="#fdf7f9" />
      <circle cx="50" cy="50" r="5.5" fill="#fb74a8" />
    </svg>
  );
}

function Avatar({ profile, size = 56, badge }) {
  const p = profile || {};
  return (
    <span className="ora-avatar" style={{ width: size, height: size }}>
      {p.photo
        ? <img src={p.photo} alt="" />
        : <span className="ora-avatarflower"><FlowerMark size={Math.round(size * 0.72)} /></span>}
      {badge !== undefined && badge !== null && <span className="ora-avatarbadge">{badge}</span>}
    </span>
  );
}

/* Downscale before storing — a full-size camera photo would blow the key limit. */
function readPhoto(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 224;
      const canvas = document.createElement("canvas");
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(S / img.width, S / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      try { cb(canvas.toDataURL("image/jpeg", 0.78)); } catch (e) { cb(null); }
    };
    img.onerror = () => cb(null);
    img.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
}

function ProfilePage({ data, setData, subtitle }) {
  const profile = data.profile || { name: "", photo: "" };
  const setProfile = (patch) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));

  return (
    <div>
      <div className="ora-profilehero">
        <label className="ora-avatarpick">
          <Avatar profile={profile} size={104} />
          <span className="ora-avataredit">{profile.photo ? t("edit") : "Add photo"}</span>
          <input type="file" accept="image/*"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) readPhoto(f, (url) => url && setProfile({ photo: url }));
            }} />
        </label>
        {profile.photo && (
          <button className="ora-clearlink" onClick={() => setProfile({ photo: "" })}>{t("remove")}</button>
        )}
      </div>

      <div className="ora-card">
        <div className="ora-field">
          <label htmlFor="ora-profilename">Name</label>
          <input id="ora-profilename" type="text" maxLength={28} placeholder="Optional"
            value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
        </div>
        <div className="ora-learnnote">
          {subtitle || "Used across the app and on anything you choose to share with a partner."}
        </div>
      </div>

      <div className="ora-note">
        Stored on this device and never uploaded. A partner only sees it if you tick it under You › Partner.
      </div>
    </div>
  );
}

/* ================================= partner ================================ */
const PARTNER_FIELDS = [
  { id: "phase", label: "Cycle day and phase", sub: "Where you are in the month" },
  { id: "period", label: "Period dates", sub: "When it started and when the next is expected" },
  { id: "pms", label: "PMS heads-up", sub: "A warning for the days before it is due" },
  { id: "symptoms", label: "Symptoms you log", sub: "Only the days you record them" },
  { id: "mood", label: "Mood you log", sub: "" },
  { id: "fertility", label: "Fertile window", sub: "Off by default" },
  { id: "notes", label: "Your notes", sub: "Off by default — these are usually private" },
  { id: "sex", label: "Sex life", sub: "Off by default" },
  { id: "photo", label: "Your profile picture", sub: "Off by default — it makes the code much longer" },
];

const packCode = (obj) => {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
  catch (e) { return ""; }
};
const unpackCode = (code) => {
  try { return JSON.parse(decodeURIComponent(escape(atob(code.trim())))); }
  catch (e) { return null; }
};

function buildSnapshot({ settings, data, stats, blocks, todayISO }) {
  const sh = settings.partner.share;
  const lastStart = blocks.length ? blocks[blocks.length - 1].start : null;
  const profile = data.profile || {};
  const days = settings.partner.expiry === undefined ? 90 : settings.partner.expiry;

  /* v2 ships the inputs, not the answers, so the partner's app can recompute
     the cycle every time they open it instead of reading a frozen number. */
  const snap = {
    v: 2,
    at: todayISO,
    exp: days ? addISO(todayISO, days) : null,
    name: settings.partner.name || profile.name || "",
    sh: {
      phase: !!sh.phase, period: !!sh.period, pms: !!sh.pms, fertility: !!sh.fertility,
      symptoms: !!sh.symptoms, mood: !!sh.mood, sex: !!sh.sex, notes: !!sh.notes,
    },
  };
  if (sh.photo && profile.photo) snap.photo = profile.photo;
  if ((sh.phase || sh.period || sh.pms || sh.fertility) && lastStart) {
    snap.start = lastStart;
    snap.len = stats.cycleLen;
    snap.plen = stats.periodLen;
  }
  const today = {};
  if (sh.symptoms && (data.symptoms[todayISO] || []).length) today.symptoms = data.symptoms[todayISO];
  if (sh.mood && (data.moods[todayISO] || []).length) today.mood = data.moods[todayISO];
  if (sh.sex && (data.sex[todayISO] || []).length) today.sex = data.sex[todayISO];
  if (sh.notes && data.notes[todayISO]) today.note = data.notes[todayISO];
  if (Object.keys(today).length) { today.on = todayISO; snap.today = today; }
  return snap;
}

/* Recomputed on every open. Projects forward through however many cycles have
   passed since the code was made, and says how far it is extrapolating. */
function derivePartner(snap, todayISO) {
  if (!snap) return null;
  if (!snap.start || !snap.len) {
    return { legacy: true, day: snap.day || null, phase: snap.phase || null,
      until: snap.until === undefined ? null : snap.until, next: snap.next || null, projected: 0 };
  }
  const len = snap.len;
  const plen = snap.plen || 5;
  const elapsed = diffISO(snap.start, todayISO);
  const cycles = elapsed >= 0 ? Math.floor(elapsed / len) : 0;
  const start = addISO(snap.start, cycles * len);
  const day = diffISO(start, todayISO) + 1;
  const next = addISO(start, len);
  const ov = addISO(start, len - 14);
  return {
    len, plen, start, next, ov, day,
    until: diffISO(todayISO, next),
    phase: phaseFor(day, len, plen),
    bleeding: day >= 1 && day <= plen,
    pms: day > len - 4 && day <= len,
    upcoming: [1, 2, 3].map((i) => addISO(start, i * len)),
    fertile: [addISO(ov, -5), addISO(ov, 1)],
    projected: cycles,
    ageDays: elapsed,
  };
}

function PartnerReadout({ snap, preview, todayISO }) {
  if (!snap) return null;
  const now = todayISO || iso(new Date());
  const expired = snap.exp && now > snap.exp;
  const who = snap.name ? snap.name : "Your partner";
  const sh = snap.sh || { phase: true, period: true, pms: true, fertility: !!snap.fertile,
    symptoms: true, mood: true, sex: true, notes: true };

  if (expired) {
    return (
      <div className={preview ? "ora-readout preview" : "ora-readout"}>
        <div className="ora-card">
          <div className="ora-logcardhead"><span className="ora-logcardtitle">This code has expired</span></div>
          <p className="ora-body">
            It was set to stop working after {prettyDate(snap.exp)}. Ask {who} for a fresh one — it takes
            them a tap.
          </p>
        </div>
      </div>
    );
  }

  const d = derivePartner(snap, now);
  const ph = d && d.phase ? PHASES[d.phase] : null;
  const today = snap.today && snap.today.on === now ? snap.today : null;
  const recent = snap.today && !today && diffISO(snap.today.on, now) <= 3 ? snap.today : null;

  return (
    <div className={preview ? "ora-readout preview" : "ora-readout"}>
      <div className="ora-readhero">
        <span className="ora-readavatar"><Avatar profile={{ photo: snap.photo }} size={54} /></span>
        <div className="ora-readname">{who}</div>
        {sh.phase && d && d.day ? (
          <>
            <div className="ora-readday">{t("cycleDay")} {d.day}</div>
            {ph && <div className="ora-readphase">{phaseName(d.phase)} {t("phase")}</div>}
          </>
        ) : (
          <div className="ora-readphase">Cycle details not shared</div>
        )}
      </div>

      {sh.period && d && d.bleeding && <div className="ora-readflag">Period due around now</div>}
      {sh.pms && d && d.pms && <div className="ora-readflag soft">PMS window — the dip is hormonal, not about you</div>}

      {sh.period && d && d.until !== null && d.until !== undefined && (
        <div className="ora-logcard">
          <div className="ora-logcardhead"><span className="ora-logcardtitle">Next period</span></div>
          <p className="ora-body">
            {d.until > 1 ? `Expected in ${d.until} days, around ${prettyDate(d.next)}.`
              : d.until === 1 ? `Expected tomorrow, ${prettyDate(d.next)}.`
              : d.until === 0 ? "Expected today."
              : `Running ${Math.abs(d.until)} ${Math.abs(d.until) === 1 ? "day" : "days"} late.`}
          </p>
          {d.upcoming && (
            <div className="ora-pills" style={{ marginTop: 12 }}>
              {d.upcoming.map((x) => <span className="ora-pill flat" key={x}>{prettyDate(x)}</span>)}
            </div>
          )}
        </div>
      )}

      {ph && (
        <div className="ora-logcard">
          <div className="ora-logcardhead"><span className="ora-logcardtitle">What is going on</span></div>
          <p className="ora-hormoneline">{ph.hormone}</p>
          <ul className="ora-bullets">{ph.feel.slice(0, 2).map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}

      {ph && (
        <div className="ora-logcard">
          <div className="ora-logcardhead"><span className="ora-logcardtitle">What tends to help</span></div>
          <ul className="ora-bullets mine">{ph.care.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}

      {(today || recent) && (
        <div className="ora-logcard">
          <div className="ora-logcardhead">
            <span className="ora-logcardtitle">{today ? "Logged today" : `Logged ${prettyDate(recent.on)}`}</span>
          </div>
          <div className="ora-pills">
            {((today || recent).mood || []).map((m) => <span className="ora-pill flat" key={m}>{m}</span>)}
            {((today || recent).symptoms || []).map((m) => <span className="ora-pill flat" key={m}>{m}</span>)}
            {((today || recent).sex || []).map((m) => <span className="ora-pill flat" key={m}>{m}</span>)}
          </div>
          {(today || recent).note && <p className="ora-body" style={{ marginTop: 12 }}>{(today || recent).note}</p>}
        </div>
      )}

      {sh.fertility && d && d.fertile && (
        <div className="ora-logcard">
          <div className="ora-logcardhead"><span className="ora-logcardtitle">{t("fertileWindow")}</span></div>
          <p className="ora-body">
            Roughly {prettyDate(d.fertile[0])} to {prettyDate(d.fertile[1])}. An estimate, not a
            contraceptive method.
          </p>
        </div>
      )}

      {d && d.projected > 0 && (
        <div className="ora-flag">
          Worked forward from a start date shared {d.projected} {d.projected === 1 ? "cycle" : "cycles"} ago,
          so these dates are an estimate on top of an estimate. A fresh code puts it right.
        </div>
      )}

      <div className="ora-note">
        Recalculated today from what {who} shared on {prettyDate(snap.at)}
        {snap.exp ? `, and stops working after ${prettyDate(snap.exp)}` : ""}. Read-only — nothing here can
        be edited or logged from this view.
      </div>
    </div>
  );
}

function PartnerPage(props) {
  const { settings, data, stats, blocks, todayISO, setSub, setSub2 } = props;
  const p = settings.partner;
  const [tab, setTab] = useState("share");
  const [entered, setEntered] = useState("");
  const [copied, setCopied] = useState(false);
  const snap = buildSnapshot({ settings, data, stats, blocks, todayISO });
  const code = p.on ? packCode(snap) : "";
  const received = entered.trim() ? unpackCode(entered) : null;

  return (
    <div>
      <div className="ora-pilltabs">
        <button className={`ora-pilltab${tab === "share" ? " on" : ""}`} onClick={() => setTab("share")}>Share mine</button>
        <button className={`ora-pilltab${tab === "view" ? " on" : ""}`} onClick={() => setTab("view")}>I have a code</button>
      </div>

      {tab === "share" ? (
        <>
          <div className="ora-card">
            <div className="ora-remhead">
              <div className="ora-remtitle">
                <span className="ora-setlabel">{t("partnerMode")}</span>
                <span className="ora-setsub">Off until you turn it on. Off again in one tap.</span>
              </div>
              <Switch on={p.on} set={(v) => setSub("partner", "on", v)} />
            </div>
          </div>

          {p.on && (
            <>
              <div className="ora-card">
                <div className="ora-field">
                  <label htmlFor="ora-pname">Show me as</label>
                  <input id="ora-pname" type="text" placeholder="Optional" maxLength={24}
                    value={p.name} onChange={(e) => setSub("partner", "name", e.target.value)} />
                </div>
              </div>

              <div className="ora-setgroup">What they can see</div>
              <div className="ora-card ora-setlist">
                {PARTNER_FIELDS.map((f) => (
                  <button className="ora-setrow" key={f.id}
                    onClick={() => setSub2("partner", "share", f.id, !p.share[f.id])}>
                    <span className="ora-setmain">
                      <span className="ora-setlabel">{f.label}</span>
                      {f.sub && <span className="ora-setsub">{f.sub}</span>}
                    </span>
                    <span className={`ora-box${p.share[f.id] ? " on" : ""}`}>{p.share[f.id] ? "✓" : ""}</span>
                  </button>
                ))}
              </div>

              <div className="ora-setgroup">Their view, as it looks today</div>
              <PartnerReadout snap={snap} preview todayISO={todayISO} />

              <div className="ora-setgroup">How long the code lasts</div>
              <div className="ora-card">
                <div className="ora-chips">
                  {[[30, "30 days"], [90, "90 days"], [365, "A year"], [0, "No expiry"]].map((o) => (
                    <button key={o[0]} className={`ora-chip${(p.expiry === undefined ? 90 : p.expiry) === o[0] ? " on" : ""}`}
                      onClick={() => setSub("partner", "expiry", o[0])}>{o[1]}</button>
                  ))}
                </div>
                <div className="ora-learnnote">
                  Turning partner mode off stops new codes, but cannot reach one already on their phone.
                  The expiry date is what ends it.
                </div>
              </div>

              <div className="ora-setgroup">Send it</div>
              <div className="ora-card">
                <pre className="ora-pre code">{code.slice(0, 120)}{code.length > 120 ? "…" : ""}</pre>
                <button className="ora-cta" style={{ marginTop: 12 }} onClick={() => {
                  try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
                  catch (err) { console.error(err); }
                }}>{copied ? "Copied" : "Copy code"}</button>
                <a className="ora-widebtn" style={{ display: "block" }}
                  href={`sms:?&body=${encodeURIComponent("Open this in Celeste: " + code.slice(0, 800))}`}>Send in a message</a>
                <div className="ora-learnnote">
                  They paste this into Celeste under Partner mode. It carries your cycle length and start
                  date, so their view recalculates itself rather than going stale.
                </div>
              </div>

              <div className="ora-flag">
                Your cycle is yours. If sharing ever stops feeling like your choice, turning it off takes one
                tap and tells no one.
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="ora-lead">Paste the code your partner sent you.</p>
          <div className="ora-card">
            <textarea className="ora-textarea" rows={4} placeholder="Paste the code here"
              value={entered} onChange={(e) => setEntered(e.target.value)} />
            {entered.trim() && !received && (
              <div className="ora-flag">That code did not scan. Check nothing was cut off when it was copied.</div>
            )}
          </div>
          {received && <PartnerReadout snap={received} todayISO={todayISO} />}
        </>
      )}
    </div>
  );
}

/* --------------------- the partner's own install --------------------- */
function PartnerApp({ settings, setSetting, setData, data }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState(!settings.partnerCode);
  const [draft, setDraft] = useState(settings.partnerCode || "");
  const snap = settings.partnerCode ? unpackCode(settings.partnerCode) : null;
  const parsed = draft.trim() ? unpackCode(draft) : null;

  return (
    <div className="ora-partnerapp">
      <div className="ora-top">
        <div className="ora-mark">cel<span>este</span><i className="ora-ver">{VERSION}</i></div>
        <button className="ora-miniprofile" onClick={() => setProfileOpen(true)}>
          <Avatar profile={data.profile} size={30} />
          {(data.profile && data.profile.name) ? data.profile.name : "You"}
        </button>
      </div>

      <div className="ora-scroll" style={{ paddingBottom: 40 }}>
        {profileOpen ? (
          <>
            <div className="ora-pagehead">
              <button className="ora-arrow" onClick={() => setProfileOpen(false)} aria-label={t("back")}>‹</button>
              <div className="ora-pagetitle">{t("yourProfile")}</div>
              <span className="ora-arrow ghost" />
            </div>
            <ProfilePage data={data} setData={setData}
              subtitle="Just for you — a partner view is one-way, so nothing here is sent back to them." />
          </>
        ) : editing ? (
          <>
            <h2 className="ora-h2 first">Paste their code</h2>
            <p className="ora-lead">They will find it in Celeste under You › Partner.</p>
            <div className="ora-card">
              <textarea className="ora-textarea" rows={4} value={draft} placeholder="Paste the code here"
                onChange={(e) => setDraft(e.target.value)} />
              {draft.trim() && !parsed && (
                <div className="ora-flag">That code did not scan. Check nothing was cut off when it was copied.</div>
              )}
              <button className="ora-cta" style={{ marginTop: 12 }} disabled={!parsed}
                onClick={() => { setSetting("partnerCode", draft.trim()); setEditing(false); }}>
                {parsed ? "Open their view" : "Waiting for a code"}
              </button>
              {settings.partnerCode && (
                <button className="ora-widebtn" onClick={() => { setDraft(settings.partnerCode); setEditing(false); }}>Cancel</button>
              )}
            </div>
          </>
        ) : (
          <>
            <PartnerReadout snap={snap} todayISO={iso(new Date())} />
            <button className="ora-widebtn" onClick={() => setEditing(true)}>Update with a newer code</button>
          </>
        )}

        <div className="ora-card" style={{ marginTop: 14 }}>
          <div className="ora-cardhead">Not what you wanted?</div>
          <div className="ora-learnnote">
            Partner view is read-only. If you want to track your own cycle instead, this switches over and
            runs setup — their snapshot is dropped.
          </div>
          <button className="ora-danger" onClick={() => {
            setData((d) => ({ ...d, settings: { ...d.settings, mode: "self", partnerCode: "", onboarded: false } }));
          }}>Track my own cycle</button>
        </div>
      </div>
    </div>
  );
}

/* ================================= import ================================= */
function parseCSV(text) {
  const firstLine = text.split("\n")[0] || "";
  const delim = firstLine.split(";").length > firstLine.split(",").length ? ";"
    : firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function detectOrder(cells) {
  let dmy = false, mdy = false;
  cells.forEach((v) => {
    const m = String(v).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (!m) return;
    if (+m[1] > 12) dmy = true;
    if (+m[2] > 12) mdy = true;
  });
  return mdy && !dmy ? "mdy" : "dmy";
}

function parseDateCell(v, order) {
  const str = String(v || "").trim();
  if (!str) return null;
  let m;
  if ((m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)))
    return iso(new Date(+m[1], +m[2] - 1, +m[3], 12));
  if ((m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) {
    const day = order === "mdy" ? +m[2] : +m[1];
    const mon = order === "mdy" ? +m[1] : +m[2];
    return iso(new Date(+m[3], mon - 1, day, 12));
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
  return null;
}

const COLUMN_MAP = [
  { field: "date", re: /^(date|day|datum|fecha|data|tarih)/i },
  { field: "flows", re: /(flow|bleed|menstrua|period|regel)/i },
  { field: "symptoms", re: /(symptom|pain|ailment|beschwerd)/i },
  { field: "moods", re: /(mood|emotion|feeling|stimmung)/i },
  { field: "discharge", re: /(mucus|fluid|discharge|cervical)/i },
  { field: "sex", re: /(sex|intercourse|intimacy)/i },
  { field: "skin", re: /(skin|hair|haut)/i },
  { field: "ovTest", re: /(ovulation test|opk|lh test)/i },
  { field: "pregTest", re: /(pregnancy test|hcg)/i },
  { field: "breast", re: /(breast|brust)/i },
  { field: "weight", re: /(weight|gewicht|peso)/i },
  { field: "temp", re: /(temp|bbt|basal)/i },
  { field: "sleep", re: /(sleep|schlaf)/i },
  { field: "water", re: /(water|wasser|hydrat)/i },
  { field: "notes", re: /(note|comment|diary|journal|notiz)/i },
  { field: "bcLog", re: /(contracept|pill taken|birth control)/i },
];

const mapFlow = (v) => {
  const x = String(v || "").trim().toLowerCase();
  if (!x || ["0", "no", "false", "none", "-", "n"].indexOf(x) > -1) return null;
  if (x.indexOf("spot") > -1) return "light";
  if (x.indexOf("light") > -1 || x.indexOf("leicht") > -1 || x === "1") return "light";
  if (x.indexOf("med") > -1 || x.indexOf("normal") > -1 || x === "2") return "medium";
  if (x.indexOf("heav") > -1 || x.indexOf("strong") > -1 || x.indexOf("stark") > -1 || x === "3" || x === "4") return "heavy";
  return "medium";
};
const splitTags = (v) => String(v || "").split(/[;,|]/).map((x) => x.trim())
  .filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
const MULTI_IMPORT = ["symptoms", "moods", "sex", "skin", "breast"];
const NUMERIC_IMPORT = ["weight", "temp", "sleep", "water"];

function analyse(text, order) {
  if (!text.trim()) return null;
  const trimmed = text.trim();

  if (trimmed.charAt(0) === "{") {
    try {
      const obj = JSON.parse(trimmed);
      const src = obj.data || obj;
      const out = {};
      LOG_FIELDS.forEach((f) => {
        Object.keys(src[f] || {}).forEach((d) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
          out[d] = out[d] || {};
          out[d][f] = src[f][d];
        });
      });
      if (!Object.keys(out).length) return { error: "That backup did not contain any logged days." };
      return { kind: "Celeste backup", dates: out, columns: ["full backup"], skipped: [] };
    } catch (e) {
      return { error: "That looks like JSON but it could not be read." };
    }
  }

  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const dateOnly = lines.every((l) => !/[A-Za-z]{4,}/.test(l))
    && lines.filter((l) => parseDateCell(l.split(/\s*(?:-|\u2013|to)\s*/)[0], order)).length === lines.length;
  if (dateOnly && lines.length) {
    const out = {};
    lines.forEach((l) => {
      const parts = l.split(/\s*(?:-|\u2013|to|,|;)\s*/);
      const a = parseDateCell(parts[0], order);
      const b = parts[1] ? parseDateCell(parts[1], order) : a;
      if (!a) return;
      const span = b && diffISO(a, b) >= 0 && diffISO(a, b) < 15 ? diffISO(a, b) : 0;
      for (let i = 0; i <= span; i++) out[addISO(a, i)] = { flows: "medium" };
    });
    if (Object.keys(out).length) return { kind: "Period dates", dates: out, columns: ["period dates"], skipped: [] };
  }

  const rows = parseCSV(trimmed);
  if (rows.length < 2) return { error: "No rows found. A header row and at least one row of data are needed." };
  const header = rows[0].map((h) => h.trim());
  const mapping = header.map((h) => {
    const hit = COLUMN_MAP.filter((c) => c.re.test(h))[0];
    return hit ? hit.field : null;
  });
  const dateCol = mapping.indexOf("date");
  if (dateCol < 0) return { error: "No date column found. One column needs a name like date, day or datum." };

  const ord = order || detectOrder(rows.slice(1).map((r) => r[dateCol]));
  const out = {};
  rows.slice(1).forEach((r) => {
    const d = parseDateCell(r[dateCol], ord);
    if (!d) return;
    const entry = out[d] || {};
    mapping.forEach((f, i) => {
      if (!f || f === "date") return;
      const raw = (r[i] || "").trim();
      if (!raw) return;
      if (f === "flows") { const v = mapFlow(raw); if (v) entry.flows = v; }
      else if (f === "bcLog") { if (/^(1|true|yes|taken|x)$/i.test(raw)) entry.bcLog = true; }
      else if (MULTI_IMPORT.indexOf(f) > -1) entry[f] = (entry[f] || []).concat(splitTags(raw));
      else if (NUMERIC_IMPORT.indexOf(f) > -1) { const n = parseFloat(raw.replace(",", ".")); if (!isNaN(n)) entry[f] = n; }
      else entry[f] = raw;
    });
    if (Object.keys(entry).length) out[d] = entry;
  });

  const used = header.filter((h, i) => mapping[i]);
  const skipped = header.filter((h, i) => !mapping[i] && h);
  if (!Object.keys(out).length) return { error: "Dates were found but no values could be read from them." };
  return { kind: "Spreadsheet", dates: out, columns: used, skipped, order: ord };
}

function ImportPage({ setData, data }) {
  const [text, setText] = useState("");
  const [order, setOrder] = useState(null);
  const [mode, setMode] = useState("merge");
  const [finished, setFinished] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const result = useMemo(() => analyse(text, order), [text, order]);
  const dates = result && result.dates ? Object.keys(result.dates).sort() : [];
  const fieldCounts = {};
  dates.forEach((d) => Object.keys(result.dates[d]).forEach((f) => { fieldCounts[f] = (fieldCounts[f] || 0) + 1; }));

  const readFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setText(String(r.result || "")); setFinished(null); };
    r.readAsText(file);
  };

  const run = () => {
    setSnapshot(data);
    setData((prev) => {
      const next = { ...prev };
      LOG_FIELDS.forEach((f) => { next[f] = { ...prev[f] }; });
      dates.forEach((d) => {
        const entry = result.dates[d];
        Object.keys(entry).forEach((f) => {
          if (LOG_FIELDS.indexOf(f) < 0) return;
          const existing = next[f][d];
          if (mode === "replace" || existing === undefined) next[f][d] = entry[f];
          else if (Array.isArray(existing) && Array.isArray(entry[f]))
            next[f][d] = existing.concat(entry[f].filter((x) => existing.indexOf(x) < 0));
        });
      });
      return next;
    });
    setFinished({ days: dates.length, from: dates[0], to: dates[dates.length - 1] });
  };

  return (
    <div>
      <p className="ora-lead">
        Export your history from your old app, then drop the file in here. Celeste reads its own backups,
        spreadsheets from most trackers, and a plain list of period dates.
      </p>

      <div className="ora-card">
        <label className="ora-filebtn">
          Choose a file
          <input type="file" accept=".csv,.json,.txt,.tsv" onChange={readFile} />
        </label>
        <div className="ora-orline">or paste it below</div>
        <textarea className="ora-textarea" rows={5} value={text}
          onChange={(e) => { setText(e.target.value); setFinished(null); }}
          placeholder={"date,flow,symptoms\n2026-08-12,medium,Cramps; Headache"} />
      </div>

      {result && result.error && (
        <div className="ora-card"><div className="ora-flag" style={{ marginTop: 0 }}>{result.error}</div></div>
      )}

      {result && !result.error && !finished && (
        <>
          <div className="ora-setgroup">What Celeste found</div>
          <div className="ora-card">
            <div className="ora-kv"><span>Format</span><strong>{result.kind}</strong></div>
            <div className="ora-kv"><span>{t("days")}</span><strong>{dates.length}</strong></div>
            <div className="ora-kv"><span>Range</span>
              <strong>{dates.length ? `${longDate(dates[0])} – ${longDate(dates[dates.length - 1])}` : "—"}</strong>
            </div>
            <div className="ora-pills" style={{ marginTop: 12 }}>
              {Object.keys(fieldCounts).map((f) => (
                <span className="ora-pill flat" key={f}>{f} · {fieldCounts[f]}</span>
              ))}
            </div>
            {result.skipped && result.skipped.length > 0 && (
              <div className="ora-flag">
                Columns left out because Celeste has nowhere to put them: {result.skipped.join(", ")}.
              </div>
            )}
          </div>

          {result.kind === "Spreadsheet" && (
            <>
              <div className="ora-setgroup">Date order</div>
              <div className="ora-card">
                <div className="ora-chips">
                  {[["dmy", "31/12/2026"], ["mdy", "12/31/2026"]].map((o) => (
                    <button key={o[0]} className={`ora-chip${(order || result.order) === o[0] ? " on" : ""}`}
                      onClick={() => setOrder(o[0])}>{o[1]}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="ora-setgroup">If a day already has something</div>
          <div className="ora-card">
            <div className="ora-chips">
              <button className={`ora-chip${mode === "merge" ? " on" : ""}`} onClick={() => setMode("merge")}>Keep mine</button>
              <button className={`ora-chip${mode === "replace" ? " on" : ""}`} onClick={() => setMode("replace")}>Overwrite</button>
            </div>
            <div className="ora-learnnote">
              {mode === "merge"
                ? "Anything already logged stays as it is. Lists get the new entries added alongside."
                : "Imported values win on any day they cover. Days not in the file are untouched."}
            </div>
          </div>

          <button className="ora-cta" onClick={run}>
            Import {dates.length} {dates.length === 1 ? t("day") : t("days")}
          </button>
        </>
      )}

      {finished && (
        <div className="ora-card">
          <div className="ora-logcardhead"><span className="ora-logcardtitle">Imported</span></div>
          <p className="ora-body">
            {finished.days} {finished.days === 1 ? t("day") : t("days")} added, {longDate(finished.from)} to {longDate(finished.to)}.
            Your averages and patterns have already recalculated.
          </p>
          {snapshot && (
            <button className="ora-danger" onClick={() => { setData(snapshot); setSnapshot(null); setFinished(null); }}>
              Undo this import
            </button>
          )}
        </div>
      )}

      <div className="ora-card">
        <div className="ora-cardhead">Getting your data out</div>
        <ul className="ora-bullets">
          <li><strong>Clue</strong> — Account, then Download my data.</li>
          <li><strong>Flo</strong> — Profile, Settings, then Export data.</li>
          <li><strong>Apple Health</strong> — needs the installed app; see Settings › Apple Health.</li>
          <li><strong>Anything else</strong> — any spreadsheet works if one column holds the date.</li>
        </ul>
      </div>
    </div>
  );
}

/* =============================== onboarding =============================== */
const GOALS = [
  { id: "track", label: "Keep track of my period", sub: "Know when it is coming, log how it goes" },
  { id: "ovulation", label: "Predict ovulation", sub: "See the fertile window and test results" },
  { id: "hormones", label: "Understand my hormones and moods", sub: "Why this week feels like this" },
  { id: "conceive", label: "Trying to conceive", sub: "Fertile window, tests, temperature" },
  { id: "symptoms", label: "Get on top of symptoms", sub: "Spot what repeats and when" },
];

function Onboarding({ todayISO, setData }) {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState("en");
  const [langOpen, setLangOpen] = useState(false);
  const [lastPeriod, setLastPeriod] = useState("");
  const [pairing, setPairing] = useState(false);
  const [code, setCode] = useState("");
  const [sharing, setSharing] = useState(false);
  const [cycle, setCycle] = useState(28);
  const [cycleKnown, setCycleKnown] = useState(true);
  const [period, setPeriod] = useState(5);
  const [periodKnown, setPeriodKnown] = useState(true);
  const [goal, setGoal] = useState(null);
  const [notif, setNotif] = useState({ periodStart: true, pms: true, ovulation: false, logPeriod: true });

  const TOTAL = 6;
  const next = () => setStep(step + 1);
  const back = () => setStep(Math.max(0, step - 1));

  const finish = (answers) => {
    setData((d) => {
      const flows = { ...d.flows };
      if (answers.lastPeriod) {
        const len = answers.period || 5;
        for (let i = 0; i < len; i++) {
          const day = addISO(answers.lastPeriod, i);
          if (day <= todayISO) flows[day] = "medium";
        }
      }
      const r = d.settings.reminders;
      return {
        ...d,
        flows,
        settings: {
          ...d.settings,
          onboarded: true,
          language: answers.lang || "en",
          mode: answers.mode || "self",
          partnerCode: answers.partnerCode || "",
          partner: { ...d.settings.partner, on: !!answers.sharing },
          goal: answers.goal,
          cycleOverride: answers.cycle,
          periodOverride: answers.period,
          show: {
            ...d.settings.show,
            fertility: answers.goal === "track" || answers.goal === "symptoms"
              ? false : d.settings.show.fertility,
          },
          remindPeriod: answers.notif.periodStart ? 2 : "off",
          remindPms: !!answers.notif.pms,
          remindOvulation: !!answers.notif.ovulation,
          reminders: {
            ...r,
            periodStart: { ...r.periodStart, on: !!answers.notif.periodStart },
            ovulation: { ...r.ovulation, on: !!answers.notif.ovulation },
            logPeriod: { ...r.logPeriod, on: !!answers.notif.logPeriod },
          },
        },
      };
    });
  };

  const done = (over) => finish({
    lang,
    lastPeriod: lastPeriod || null,
    cycle: cycleKnown ? cycle : null,
    period: periodKnown ? period : null,
    goal,
    notif: over === "skipNotif" ? { periodStart: false, pms: false, ovulation: false, logPeriod: false } : notif,
    sharing,
  });

  const chosen = LANGUAGES.filter((l) => l.code === lang)[0] || LANGUAGES[0];

  if (langOpen) {
    return (
      <div className="ora-onboard">
        <div className="ora-obtop">
          <button className="ora-arrow small" onClick={() => setLangOpen(false)} aria-label={t("back")}>‹</button>
          <div className="ora-obcount" style={{ margin: 0 }}>{t("language")}</div>
        </div>
        <div className="ora-obbody" style={{ paddingTop: 22 }}>
          <h1 className="ora-obtitle">{t("chooseLanguage")}</h1>
          <div className="ora-card ora-setlist" style={{ marginTop: 8 }}>
            {LANGUAGES.map((l) => (
              <button className="ora-setrow" key={l.code}
                onClick={() => { setLang(l.code); LANG = l.code; setLangOpen(false); }}>
                <span className="ora-setmain">
                  <span className="ora-setlabel">{l.native}</span>
                  <span className="ora-setsub">{l.name}</span>
                </span>
                {lang === l.code && <span className="ora-ticked">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (pairing) {
    const parsed = code.trim() ? unpackCode(code) : null;
    return (
      <div className="ora-onboard">
        <div className="ora-obtop">
          <button className="ora-arrow small" onClick={() => setPairing(false)} aria-label={t("back")}>‹</button>
          <div className="ora-obcount" style={{ margin: 0 }}>{t("partnerMode")}</div>
        </div>
        <div className="ora-obbody" style={{ paddingTop: 22 }}>
          <h1 className="ora-obtitle">Following someone else's cycle</h1>
          <p className="ora-oblead">
            Paste the code they sent you. Celeste will show what they chose to share and nothing more — you
            will not be asked anything about yourself.
          </p>
          <div className="ora-card">
            <textarea className="ora-textarea" rows={4} value={code} placeholder="Paste the code here"
              onChange={(e) => setCode(e.target.value)} />
            {code.trim() && !parsed && (
              <div className="ora-flag">That code did not scan. Check nothing was cut off when it was copied.</div>
            )}
          </div>
          <div className="ora-obfoot">
            <button className="ora-cta" disabled={!parsed}
              onClick={() => finish({ lang, mode: "partner", partnerCode: code.trim(), lastPeriod: null,
                cycle: null, period: null, goal: null, notif: { periodStart: false, pms: false, ovulation: false, logPeriod: false } })}>
              {t("cont")}
            </button>
            <button className="ora-skip"
              onClick={() => finish({ lang, mode: "partner", partnerCode: "", lastPeriod: null, cycle: null,
                period: null, goal: null, notif: { periodStart: false, pms: false, ovulation: false, logPeriod: false } })}>
              I don't have a code yet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ora-onboard">
      {step === 0 && (
        <div className="ora-oblangbar">
          <button className="ora-langpill" onClick={() => setLangOpen(true)}>
            <GlobeIcon />{chosen.native}
          </button>
        </div>
      )}
      {step > 0 && (
        <div className="ora-obtop">
          <button className="ora-arrow small" onClick={back} aria-label={t("back")}>‹</button>
          <div className="ora-obprogress">
            <div className="ora-obcount">{t("step")} {step} {t("of")} {TOTAL}</div>
            <div className="ora-obbar"><span style={{ width: `${(step / TOTAL) * 100}%` }} /></div>
          </div>
        </div>
      )}

      <div className="ora-obbody">
        {step === 0 && (
          <div className="ora-obwelcome">
            <div className="ora-mark big">cel<span>este</span></div>
            <h1 className="ora-obtitle">{t("setupTitle")}</h1>
            <p className="ora-oblead">
              Five quick questions, and you can skip any of them. Celeste fills the gaps with averages and
              replaces them with your own numbers as you log.
            </p>
            <button className="ora-cta" onClick={next}>{t("getStarted")}</button>
            <button className="ora-secondary" onClick={() => setPairing(true)}>
              {t("followPartner")}
            </button>
            <button className="ora-skip" onClick={() => finish({ lang, lastPeriod: null, cycle: null, period: null, goal: null, notif: { periodStart: true, pms: true, ovulation: false, logPeriod: true } })}>
              {t("skipSetup")}
            </button>
          </div>
        )}

        {step === 1 && (
          <>
            <h1 className="ora-obtitle">{t("qLastPeriod")}</h1>
            <p className="ora-oblead">The first day of bleeding. A rough guess is better than nothing.</p>
            <label className="ora-obdate">
              <span className="ora-obdatetext">{lastPeriod ? prettyDate(lastPeriod) : t("pickDate")}</span>
              <input type="date" max={todayISO} value={lastPeriod}
                onChange={(e) => setLastPeriod(e.target.value)} />
            </label>
            <div className="ora-chips" style={{ justifyContent: "center", marginTop: 14 }}>
              {[[t("today"), 0], [t("aWeekAgo"), -7], [t("twoWeeksAgo"), -14]].map((q) => (
                <button key={q[0]} className={`ora-chip${lastPeriod === addISO(todayISO, q[1]) ? " on" : ""}`}
                  onClick={() => setLastPeriod(addISO(todayISO, q[1]))}>{q[0]}</button>
              ))}
            </div>
            <div className="ora-obfoot">
              <button className="ora-cta" onClick={next} disabled={!lastPeriod}>{t("cont")}</button>
              <button className="ora-skip" onClick={() => { setLastPeriod(""); next(); }}>{t("dontRemember")}</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="ora-obtitle">{t("qCycleLength")}</h1>
            <p className="ora-oblead">First day of one period to the first day of the next. Most people land between 24 and 35 days.</p>
            <Stepper value={cycle} setValue={(v) => { setCycle(v); setCycleKnown(true); }}
              min={18} max={45} unit={t("days")} dim={!cycleKnown} />
            <div className="ora-obfoot">
              <button className="ora-cta" onClick={() => { setCycleKnown(true); next(); }}>{t("cont")}</button>
              <button className="ora-skip" onClick={() => { setCycleKnown(false); next(); }}>{t("notSure")}</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="ora-obtitle">{t("qPeriodLength")}</h1>
            <p className="ora-oblead">Counting from the first day of bleeding to the last.</p>
            <Stepper value={period} setValue={(v) => { setPeriod(v); setPeriodKnown(true); }}
              min={1} max={12} unit={t("days")} dim={!periodKnown} />
            <div className="ora-obfoot">
              <button className="ora-cta" onClick={() => { setPeriodKnown(true); next(); }}>{t("cont")}</button>
              <button className="ora-skip" onClick={() => { setPeriodKnown(false); next(); }}>{t("notSure")}</button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="ora-obtitle">{t("qGoal")}</h1>
            <p className="ora-oblead">This shapes what Celeste puts in front of you. You can change it later.</p>
            <div className="ora-oblist">
              {GOALS.map((g) => (
                <button key={g.id} className={`ora-obopt${goal === g.id ? " on" : ""}`} onClick={() => setGoal(g.id)}>
                  <span className="ora-setmain">
                    <span className="ora-setlabel">{g.label}</span>
                    <span className="ora-setsub">{g.sub}</span>
                  </span>
                  <span className={`ora-box${goal === g.id ? " on" : ""}`}>{goal === g.id ? "✓" : ""}</span>
                </button>
              ))}
            </div>
            <div className="ora-obfoot">
              <button className="ora-cta" onClick={next} disabled={!goal}>{t("cont")}</button>
              <button className="ora-skip" onClick={() => { setGoal(null); next(); }}>{t("skip")}</button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="ora-obtitle">{t("qNotif")}</h1>
            <p className="ora-oblead">All of these can be retimed or switched off later in Settings.</p>
            <div className="ora-oblist">
              {[
                { id: "periodStart", label: "Period is coming", sub: "Two days before it is due" },
                { id: "pms", label: "PMS window", sub: "The few days before" },
                { id: "ovulation", label: "Ovulation day", sub: "On the estimated day" },
                { id: "logPeriod", label: "Remember to log", sub: "A nudge on the day it should start" },
              ].map((n) => (
                <div className="ora-obopt static" key={n.id}>
                  <span className="ora-setmain">
                    <span className="ora-setlabel">{n.label}</span>
                    <span className="ora-setsub">{n.sub}</span>
                  </span>
                  <Switch on={notif[n.id]} set={(v) => setNotif({ ...notif, [n.id]: v })} />
                </div>
              ))}
            </div>
            <div className="ora-obfoot">
              <button className="ora-cta" onClick={next}>{t("cont")}</button>
              <button className="ora-skip" onClick={() => { setNotif({ periodStart: false, pms: false, ovulation: false, logPeriod: false }); next(); }}>{t("notNow")}</button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <h1 className="ora-obtitle">{t("qShare")}</h1>
            <p className="ora-oblead">
              They get a read-only view of whatever you tick, and can see what tends to help in each phase.
              You choose the fields, and turning it off later takes one tap.
            </p>
            <div className="ora-oblist">
              <button className={`ora-obopt${sharing ? " on" : ""}`} onClick={() => setSharing(true)}>
                <span className="ora-setmain">
                  <span className="ora-setlabel">Turn on partner mode</span>
                  <span className="ora-setsub">Pick what to share in You › Partner</span>
                </span>
                <span className={`ora-box${sharing ? " on" : ""}`}>{sharing ? "✓" : ""}</span>
              </button>
              <button className={`ora-obopt${!sharing ? " on" : ""}`} onClick={() => setSharing(false)}>
                <span className="ora-setmain">
                  <span className="ora-setlabel">Keep it to myself</span>
                  <span className="ora-setsub">You can switch this on any time</span>
                </span>
                <span className={`ora-box${!sharing ? " on" : ""}`}>{!sharing ? "✓" : ""}</span>
              </button>
            </div>
            <div className="ora-obfoot">
              <button className="ora-cta" onClick={() => done()}>{t("finishSetup")}</button>
              <button className="ora-skip" onClick={() => { setSharing(false); done(); }}>{t("skip")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stepper({ value, setValue, min, max, unit, dim }) {
  return (
    <div className={`ora-stepper${dim ? " dim" : ""}`}>
      <button onClick={() => setValue(Math.max(min, value - 1))} aria-label="Less">−</button>
      <div className="ora-steppervalue">
        <span>{value}</span>
        <em>{unit}</em>
      </div>
      <button onClick={() => setValue(Math.min(max, value + 1))} aria-label="More">+</button>
    </div>
  );
}

/* ================================ settings ================================ */
function mergeSettings(saved) {
  const base = BLANK.settings;
  const out = { ...base, ...(saved || {}) };
  ["reminders", "medicine", "other", "show", "partner"].forEach((g) => {
    out[g] = { ...base[g], ...((saved || {})[g] || {}) };
  });
  Object.keys(base.reminders).forEach((k) => {
    out.reminders[k] = { ...base.reminders[k], ...(out.reminders[k] || {}) };
  });
  ["dailyLog", "breastExam", "water"].forEach((k) => {
    out.other[k] = { ...base.other[k], ...(out.other[k] || {}) };
  });
  out.medicine.contraceptive = { ...base.medicine.contraceptive, ...(out.medicine.contraceptive || {}) };
  out.medicine.others = out.medicine.others || [];
  out.partner.share = { ...base.partner.share, ...((out.partner || {}).share || {}) };
  return out;
}

const REMINDER_TYPES = [
  { id: "periodStart", label: "Period starts", sub: "Before the day your period is due",
    preset: "Your period is due soon. Worth having what you need to hand." },
  { id: "periodEnd", label: "Period ends", sub: "Around the last day of bleeding",
    preset: "Your period should be wrapping up around now." },
  { id: "logPeriod", label: "Log your period", sub: "A nudge to record the day it starts",
    preset: "Did your period start today? Tap to log it." },
  { id: "fertile", label: "Fertile window is coming", sub: "Before the window opens",
    preset: "Your fertile window opens soon." },
  { id: "ovulation", label: "Ovulation day", sub: "On the estimated day",
    preset: "Ovulation is estimated for today." },
];

const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "sq", name: "Albanian", native: "Shqip" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
];

const WALLPAPERS = [
  { id: "none", label: "None", animated: false },
  { id: "blush", label: "Blush", animated: false },
  { id: "petals", label: "Petal grid", animated: false },
  { id: "arc", label: "Soft arc", animated: false },
  { id: "aurora", label: "Aurora", animated: true },
  { id: "drift", label: "Drift", animated: true },
];

const SETTINGS_MENU = [
  { group: t("notifications"), items: [
    { id: "reminders", label: t("cycleReminders"), sub: "" },
    { id: "medicine", label: t("medicineReminders"), sub: "" },
    { id: "other", label: t("otherReminders"), sub: "" },
  ] },
  { group: t("appSection"), items: [
    { id: "language", label: t("language"), sub: "" },
    { id: "theme", label: t("themeWallpaper"), sub: "" },
    { id: "display", label: t("displayHide"), sub: "" },
    { id: "widgets", label: t("widgets"), sub: "" },
    { id: "health", label: t("appleHealth"), sub: "" },
    { id: "changelog", label: t("versionHistory"), sub: "v" + VERSION },
  ] },
  { group: t("yourData"), items: [
    { id: "import", label: t("importData"), sub: "" },
    { id: "report", label: t("exportReport"), sub: "" },
  ] },
];

function SettingsOverlay({ initialPage, close, settings, setSetting, setSub, setSub2, setData, data, method, stats, blocks, todayISO, cycleDay, phaseKey }) {
  const [page, setPage] = useState(initialPage || "root");
  const shared = { settings, setSetting, setSub, setSub2, setData, data, method, stats, blocks, todayISO, cycleDay, phaseKey };
  const titles = {
    reminders: "Cycle reminders", medicine: "Medicine reminders", other: "Other reminders",
    language: "Language", theme: "Theme & wallpaper", display: "Display & hide",
    widgets: t("widgets"), health: t("appleHealth"), report: t("exportReport"), import: t("importData"),
    changelog: t("versionHistory"),
    bug: "Report a bug", feedback: "Send feedback",
  };

  return (
    <div className="ora-settings">
      <div className="ora-pagehead sticky">
        <button className="ora-arrow" onClick={() => (page === "root" ? close() : setPage("root"))}
          aria-label={page === "root" ? "Close settings" : "Back"}>‹</button>
        <div className="ora-pagetitle">{page === "root" ? t("settings") : titles[page]}</div>
        <button className="ora-arrow ghost" onClick={close} aria-label="Close settings">✕</button>
      </div>

      <div className="ora-settingsscroll">
        {page === "root" && <SettingsRoot go={setPage} settings={settings} />}
        {page === "reminders" && <CycleRemindersPage {...shared} />}
        {page === "medicine" && <MedicinePage {...shared} />}
        {page === "other" && <OtherRemindersPage {...shared} />}
        {page === "language" && <LanguagePage {...shared} />}
        {page === "theme" && <ThemePage {...shared} />}
        {page === "display" && <DisplayPage {...shared} />}
        {page === "widgets" && <WidgetsPage {...shared} />}
        {page === "health" && <HealthPage {...shared} />}
        {page === "report" && <ReportPage {...shared} />}
        {page === "import" && <ImportPage {...shared} />}
        {page === "changelog" && <ChangelogPage />}
        {page === "bug" && <MessagePage kind="bug" />}
        {page === "feedback" && <MessagePage kind="feedback" />}
      </div>
    </div>
  );
}

function SettingsRoot({ go, settings }) {
  const lang = LANGUAGES.filter((l) => l.code === settings.language)[0];
  const onCount = Object.keys(settings.reminders).filter((k) => settings.reminders[k].on).length;
  const subs = {
    reminders: `${onCount} of ${REMINDER_TYPES.length} on`,
    language: lang ? lang.native : "English",
    theme: `${settings.theme === "dark" ? "Dark" : "Light"}${settings.wallpaper !== "none" ? " · wallpaper on" : ""}`,
    health: settings.health ? "On" : "Off",
  };
  return (
    <div>
      {SETTINGS_MENU.map((sec) => (
        <React.Fragment key={sec.group}>
          <div className="ora-setgroup">{sec.group}</div>
          <div className="ora-card ora-setlist">
            {sec.items.map((it) => (
              <button className="ora-setrow" key={it.id} onClick={() => go(it.id)}>
                <span className="ora-setmain">
                  <span className="ora-setlabel">{it.label}</span>
                  {(subs[it.id] || it.sub) && <span className="ora-setsub">{subs[it.id] || it.sub}</span>}
                </span>
                <span className="ora-chev">›</span>
              </button>
            ))}
          </div>
        </React.Fragment>
      ))}

      <div className="ora-setgroup">{t("support")}</div>
      <div className="ora-card ora-setlist">
        <button className="ora-setrow" onClick={() => go("bug")}>
          <span className="ora-setmain"><span className="ora-setlabel">{t("reportBug")}</span></span>
          <span className="ora-chev">›</span>
        </button>
        <button className="ora-setrow" onClick={() => go("feedback")}>
          <span className="ora-setmain"><span className="ora-setlabel">{t("sendFeedback")}</span></span>
          <span className="ora-chev">›</span>
        </button>
        <a className="ora-setrow" href="https://apps.apple.com" target="_blank" rel="noreferrer">
          <span className="ora-setmain"><span className="ora-setlabel">{t("rateApp")}</span>
            <span className="ora-setsub">Opens the App Store</span></span>
          <span className="ora-chev">›</span>
        </a>
      </div>
      <div className="ora-note">Celeste {VERSION}</div>
    </div>
  );
}

/* ------------------------- cycle reminders ------------------------- */
function CycleRemindersPage({ settings, setSub2 }) {
  const [open, setOpen] = useState(null);
  return (
    <div>
      <p className="ora-lead">Each one can be switched on or off, scheduled, and given your own wording.</p>
      {REMINDER_TYPES.map((t) => {
        const r = settings.reminders[t.id];
        const isOpen = open === t.id;
        return (
          <div className={`ora-card ora-remcard${isOpen ? " open" : ""}`} key={t.id}>
            <div className="ora-remhead">
              <button className="ora-remtitle" onClick={() => setOpen(isOpen ? null : t.id)}>
                <span className="ora-setlabel">{t.label}</span>
                <span className="ora-setsub">
                  {r.on ? `${r.days === 0 ? "On the day" : `${r.days} ${r.days === 1 ? "day" : "days"} before`} · ${r.time}` : t.sub}
                </span>
              </button>
              <Switch on={r.on} set={(v) => setSub2("reminders", t.id, "on", v)} />
            </div>

            {isOpen && (
              <div className="ora-rembody">
                <div className="ora-field">
                  <label>When</label>
                  <select value={String(r.days)} onChange={(e) => setSub2("reminders", t.id, "days", Number(e.target.value))}>
                    <option value="0">On the day</option>
                    <option value="1">1 day before</option>
                    <option value="2">2 days before</option>
                    <option value="3">3 days before</option>
                    <option value="4">4 days before</option>
                    <option value="5">5 days before</option>
                  </select>
                </div>
                <div className="ora-field">
                  <label>Time</label>
                  <input type="time" value={r.time} onChange={(e) => setSub2("reminders", t.id, "time", e.target.value)} />
                </div>
                <div className="ora-sublab">Message</div>
                <div className="ora-chips">
                  <button className={`ora-chip${!r.message ? " on" : ""}`} onClick={() => setSub2("reminders", t.id, "message", "")}>Preset</button>
                  <button className={`ora-chip${r.message ? " on" : ""}`}
                    onClick={() => setSub2("reminders", t.id, "message", r.message || t.preset)}>My own words</button>
                </div>
                {r.message ? (
                  <textarea className="ora-textarea" rows={2} style={{ marginTop: 10 }} value={r.message}
                    maxLength={140} onChange={(e) => setSub2("reminders", t.id, "message", e.target.value)} />
                ) : (
                  <div className="ora-preview">{t.preset}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="ora-note">
        Reminders show at the top of Today. Push notifications arrive when Celeste runs as an installed app.
      </div>
    </div>
  );
}

function Switch({ on, set, disabled }) {
  return (
    <button className={`ora-switch btn${on ? " on" : ""}${disabled ? " off" : ""}`} disabled={disabled}
      onClick={() => set(!on)} role="switch" aria-checked={on} aria-label="Toggle"><i /></button>
  );
}

/* --------------------------- medicine --------------------------- */
function MedicinePage({ settings, setSub, setSub2, method }) {
  const others = settings.medicine.others;
  const setOthers = (list) => setSub("medicine", "others", list);
  const c = settings.medicine.contraceptive;

  return (
    <div>
      <div className="ora-setgroup">Contraceptive</div>
      <div className="ora-card">
        <div className="ora-remhead">
          <div className="ora-remtitle">
            <span className="ora-setlabel">{method.id === "none" ? "Contraception" : method.label}</span>
            <span className="ora-setsub">{method.id === "none" ? "Set your method in You › Birth control" : `Daily at ${c.time}`}</span>
          </div>
          <Switch on={c.on} set={(v) => setSub2("medicine", "contraceptive", "on", v)} disabled={method.id === "none"} />
        </div>
        {c.on && (
          <div className="ora-field">
            <label>Time</label>
            <input type="time" value={c.time} onChange={(e) => setSub2("medicine", "contraceptive", "time", e.target.value)} />
          </div>
        )}
      </div>

      <div className="ora-setgroup">Other medicine & vitamins</div>
      {others.map((o, i) => (
        <div className="ora-card" key={o.id}>
          <div className="ora-remhead">
            <input className="ora-inlineinput" value={o.name} placeholder="Name"
              onChange={(e) => setOthers(others.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            <Switch on={o.on} set={(v) => setOthers(others.map((x, k) => (k === i ? { ...x, on: v } : x)))} />
          </div>
          <div className="ora-field">
            <label>Time</label>
            <input type="time" value={o.time}
              onChange={(e) => setOthers(others.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)))} />
          </div>
          <button className="ora-danger" style={{ marginTop: 6 }}
            onClick={() => setOthers(others.filter((x, k) => k !== i))}>Remove</button>
        </div>
      ))}
      <button className="ora-widebtn" style={{ marginTop: 0 }}
        onClick={() => setOthers([...others, { id: `m${Date.now()}`, name: "", time: "09:00", on: true }])}>
        Add a medicine or vitamin
      </button>
    </div>
  );
}

/* ------------------------ other reminders ------------------------ */
function OtherRemindersPage({ settings, setSub2 }) {
  const o = settings.other;
  return (
    <div>
      <div className="ora-card">
        <div className="ora-remhead">
          <div className="ora-remtitle">
            <span className="ora-setlabel">Daily log</span>
            <span className="ora-setsub">A nudge to record how the day went</span>
          </div>
          <Switch on={o.dailyLog.on} set={(v) => setSub2("other", "dailyLog", "on", v)} />
        </div>
        {o.dailyLog.on && (
          <div className="ora-field">
            <label>Time</label>
            <input type="time" value={o.dailyLog.time} onChange={(e) => setSub2("other", "dailyLog", "time", e.target.value)} />
          </div>
        )}
      </div>

      <div className="ora-card">
        <div className="ora-remhead">
          <div className="ora-remtitle">
            <span className="ora-setlabel">Breast self-exam</span>
            <span className="ora-setsub">Best done a few days after your period ends</span>
          </div>
          <Switch on={o.breastExam.on} set={(v) => setSub2("other", "breastExam", "on", v)} />
        </div>
        {o.breastExam.on && (
          <>
            <div className="ora-field">
              <label>Cycle day</label>
              <select value={String(o.breastExam.day)} onChange={(e) => setSub2("other", "breastExam", "day", Number(e.target.value))}>
                {[5, 6, 7, 8, 9, 10, 12].map((d) => <option key={d} value={d}>Day {d}</option>)}
              </select>
            </div>
            <div className="ora-field">
              <label>Time</label>
              <input type="time" value={o.breastExam.time} onChange={(e) => setSub2("other", "breastExam", "time", e.target.value)} />
            </div>
            <div className="ora-flag">Tissue is least lumpy in the week after bleeding stops, so changes are easier to notice.</div>
          </>
        )}
      </div>

      <div className="ora-card">
        <div className="ora-remhead">
          <div className="ora-remtitle">
            <span className="ora-setlabel">Drink water</span>
            <span className="ora-setsub">Spaced through the day</span>
          </div>
          <Switch on={o.water.on} set={(v) => setSub2("other", "water", "on", v)} />
        </div>
        {o.water.on && (
          <>
            <div className="ora-field">
              <label>From</label>
              <input type="time" value={o.water.from} onChange={(e) => setSub2("other", "water", "from", e.target.value)} />
            </div>
            <div className="ora-field">
              <label>Until</label>
              <input type="time" value={o.water.to} onChange={(e) => setSub2("other", "water", "to", e.target.value)} />
            </div>
            <div className="ora-field">
              <label>Every</label>
              <select value={String(o.water.every)} onChange={(e) => setSub2("other", "water", "every", Number(e.target.value))}>
                {[1, 2, 3, 4].map((h) => <option key={h} value={h}>{h} {h === 1 ? "hour" : "hours"}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------- language --------------------------- */
function LanguagePage({ settings, setSetting }) {
  return (
    <div>
      <div className="ora-card ora-setlist">
        {LANGUAGES.map((l) => (
          <button className="ora-setrow" key={l.code} onClick={() => setSetting("language", l.code)}>
            <span className="ora-setmain">
              <span className="ora-setlabel">{l.native}</span>
              <span className="ora-setsub">{l.name}</span>
            </span>
            {settings.language === l.code && <span className="ora-ticked">✓</span>}
          </button>
        ))}
      </div>
      <div className="ora-note">
        Your choice is saved. Only the English strings are bundled in this build, so the interface stays
        in English until the translation files ship.
      </div>
    </div>
  );
}

/* ----------------------------- theme ----------------------------- */
function ThemePage({ settings, setSetting }) {
  return (
    <div>
      <div className="ora-setgroup">Mode</div>
      <div className="ora-card">
        <div className="ora-flowrow">
          {[["light", "Light"], ["dark", "Dark"]].map(([id, label]) => (
            <button key={id} className={`ora-flowbtn${settings.theme === id ? " on" : ""}`}
              onClick={() => setSetting("theme", id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="ora-setgroup">Wallpaper</div>
      <div className="ora-card">
        <div className="ora-wallgrid">
          {WALLPAPERS.map((w) => (
            <button key={w.id} className={`ora-wall${settings.wallpaper === w.id ? " on" : ""}`}
              onClick={() => setSetting("wallpaper", w.id)}>
              <span className={`ora-wallswatch wp-${w.id}`} />
              <span className="ora-walllabel">{w.label}</span>
              {w.animated && <span className="ora-wallanim">Animated</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- display & hide ------------------------- */
function DisplayPage({ settings, setSetting, setSub }) {
  const show = settings.show;
  return (
    <div>
      <div className="ora-setgroup">Calendar</div>
      <div className="ora-card">
        <div className="ora-field">
          <label>Date format</label>
          <select value={settings.dateFormat} onChange={(e) => setSetting("dateFormat", e.target.value)}>
            <option value="d-mmm">Tue 12 Aug</option>
            <option value="dmy">12.08.2026</option>
            <option value="mdy">08/12/2026</option>
            <option value="ymd">2026-08-12</option>
          </select>
        </div>
        <div className="ora-field">
          <label>Week starts on</label>
          <select value={String(settings.firstDay)} onChange={(e) => setSetting("firstDay", Number(e.target.value))}>
            <option value="1">Monday</option>
            <option value="0">Sunday</option>
          </select>
        </div>
      </div>

      <div className="ora-setgroup">Show or hide</div>
      <div className="ora-card">
        <Toggle label="Symptoms" sub="Symptom chips in the log and patterns in Insights"
          on={show.symptoms} set={(v) => setSub("show", "symptoms", v)} />
        <Toggle label="Mood" sub="Mood chips and mood patterns"
          on={show.mood} set={(v) => setSub("show", "mood", v)} />
        <Toggle label="Ovulation & pregnancy prediction" sub="Fertile window, ovulation markers and chance of conceiving"
          on={show.fertility} set={(v) => setSub("show", "fertility", v)} />
        <Toggle label="Sex life" sub="Log intimacy alongside everything else"
          on={show.sex} set={(v) => setSub("show", "sex", v)} />
        <div className="ora-learnnote">
          Hiding something keeps what you have already logged. It only stops Celeste showing or asking for it.
        </div>
      </div>
    </div>
  );
}

/* --------------------------- apple health --------------------------- */
function HealthPage({ settings, setSetting }) {
  return (
    <div>
      <div className="ora-card">
        <div className="ora-remhead">
          <div className="ora-remtitle">
            <span className="ora-setlabel">Sync with Apple Health</span>
            <span className="ora-setsub">Two-way, for cycle data only</span>
          </div>
          <Switch on={settings.health} set={(v) => setSetting("health", v)} />
        </div>
        <div className="ora-flag">
          The switch is saved here, but the handshake itself needs the installed iOS app — a browser
          cannot reach HealthKit. On device this turns on immediately.
        </div>
      </div>
      <div className="ora-card">
        <div className="ora-cardhead">What would sync</div>
        <ul className="ora-bullets">
          <li>Menstrual flow and spotting</li>
          <li>Cycle start dates and period length</li>
          <li>Basal body temperature, if you record it elsewhere</li>
          <li>Ovulation test results and cervical fluid</li>
        </ul>
        <div className="ora-learnnote">Notes, moods and free text stay in Celeste and are never written to Health.</div>
      </div>
    </div>
  );
}

/* ----------------------------- widgets ----------------------------- */
function WidgetsPage({ stats, cycleDay, phaseKey, blocks, todayISO }) {
  const lastStart = blocks.length ? blocks[blocks.length - 1].start : null;
  const until = lastStart ? diffISO(todayISO, addISO(lastStart, stats.cycleLen)) : null;
  const phase = phaseKey ? PHASES[phaseKey] : null;

  return (
    <div>
      <p className="ora-lead">Add these from your home screen. Each one updates as you log.</p>

      <div className="ora-setgroup">Small</div>
      <div className="ora-widgetrow">
        <div className="ora-wsmall">
          <div className="ora-weyebrow">Cycle day</div>
          <div className="ora-wbig">{cycleDay || "–"}</div>
          <div className="ora-wfoot">{phase ? phase.name : "Not tracking"}</div>
        </div>
        <div className="ora-wsmall rose">
          <div className="ora-weyebrow light">Period in</div>
          <div className="ora-wbig light">{until === null ? "–" : Math.max(0, until)}</div>
          <div className="ora-wfoot light">{until === null ? "Log a period" : "days"}</div>
        </div>
      </div>

      <div className="ora-setgroup">Medium</div>
      <div className="ora-wmed">
        <div className="ora-wmedleft">
          <div className="ora-weyebrow">Day {cycleDay || "–"}</div>
          <div className="ora-wmedtitle">{phase ? phase.name + " phase" : "No cycle logged"}</div>
          <div className="ora-wfoot">{until === null ? "" : until > 0 ? `Period in ${until} days` : "Period due"}</div>
        </div>
        <div className="ora-wstrip">
          {Array.from({ length: 14 }).map((_, i) => {
            const day = (cycleDay || 1) - 6 + i;
            const inPeriod = day >= 1 && day <= stats.periodLen;
            const isNow = day === cycleDay;
            return <span key={i} className={`ora-wtick${inPeriod ? " bled" : ""}${isNow ? " now" : ""}`} />;
          })}
        </div>
      </div>

      <div className="ora-setgroup">Large</div>
      <div className="ora-wlarge">
        <div className="ora-wmedtitle">{phase ? phase.name + " phase" : "No cycle logged"}</div>
        <div className="ora-wfoot" style={{ marginBottom: 12 }}>
          {until === null ? "Log a period to start" : until > 0 ? `Period expected in ${until} days` : "Period expected"}
        </div>
        <div className="ora-wmonth">
          {Array.from({ length: 28 }).map((_, i) => {
            const day = i + 1;
            const cls = day <= stats.periodLen ? "bled" : day === cycleDay ? "now" : "";
            return <span key={i} className={`ora-wcell ${cls}`} />;
          })}
        </div>
        <div className="ora-wfoot" style={{ marginTop: 12 }}>
          {stats.cycleLen}-day average · {stats.periodLen}-day period
        </div>
      </div>

      <div className="ora-note">Previews. On device, widgets are added from the home screen.</div>
    </div>
  );
}

/* --------------------------- export report --------------------------- */
const REPORT_FIELDS = [
  { id: "dates", label: "Period dates" },
  { id: "cycle", label: "Cycle lengths" },
  { id: "flow", label: "Flow intensity" },
  { id: "symptoms", label: "Symptoms" },
  { id: "mood", label: "Mood" },
  { id: "skin", label: "Skin & hair" },
  { id: "sex", label: "Sex life" },
  { id: "tests", label: "Test results" },
  { id: "lifestyle", label: "Weight, temp, sleep, water" },
  { id: "fluid", label: "Cervical fluid" },
  { id: "bc", label: "Contraception" },
  { id: "notes", label: "Notes" },
];

function ReportPage({ data, blocks, stats, todayISO }) {
  const [range, setRange] = useState(6);
  const [fields, setFields] = useState(["dates", "cycle", "flow", "symptoms", "mood", "notes"]);
  const [done, setDone] = useState("");

  const chosen = range === "all" ? blocks : blocks.slice(-range);
  const from = chosen.length ? chosen[0].start : todayISO;
  const has = (f) => fields.indexOf(f) > -1;
  const toggle = (f) => setFields(has(f) ? fields.filter((x) => x !== f) : [...fields, f]);

  const build = () => {
    const L = [];
    L.push("CELESTE CYCLE REPORT");
    L.push(`Generated ${prettyDate(todayISO)}`);
    L.push(`Covering ${chosen.length} ${chosen.length === 1 ? "cycle" : "cycles"} from ${prettyDate(from)}`);
    L.push("");
    L.push(`Average cycle: ${stats.cycleLen} days`);
    L.push(`Average period: ${stats.periodLen} days`);
    if (stats.spread !== null) L.push(`Cycle variation: ${stats.spread} days`);
    L.push("");
    chosen.slice().reverse().forEach((b, i) => {
      const idx = blocks.indexOf(b);
      const next = blocks[idx + 1];
      const len = diffISO(b.start, b.end) + 1;
      L.push(`— ${spanLabel(b.start, b.end)}`);
      if (has("dates")) L.push(`   Bled ${len} ${len === 1 ? "day" : "days"}`);
      if (has("cycle")) L.push(`   Cycle length: ${next ? `${diffISO(b.start, next.start)} days` : "still running"}`);
      const until = next ? next.start : addISO(todayISO, 1);
      const days = loggedDates(data).filter((d) => d >= b.start && d < until);
      days.forEach((d) => {
        const bits = [];
        if (has("flow") && data.flows[d]) bits.push(`flow ${data.flows[d]}`);
        if (has("skin") && (data.skin[d] || []).length) bits.push(`skin ${data.skin[d].join(", ")}`);
        if (has("sex") && (data.sex[d] || []).length) bits.push(`sex ${data.sex[d].join(", ")}`);
        if (has("tests") && data.ovTest[d]) bits.push(`ovulation test ${data.ovTest[d]}`);
        if (has("tests") && data.pregTest[d]) bits.push(`pregnancy test ${data.pregTest[d]}`);
        if (has("lifestyle") && data.temp[d]) bits.push(`${data.temp[d]} °C`);
        if (has("lifestyle") && data.weight[d]) bits.push(`${data.weight[d]} kg`);
        if (has("lifestyle") && data.sleep[d]) bits.push(`slept ${data.sleep[d]} hrs`);
        if (has("mood") && (data.moods[d] || []).length) bits.push(`mood ${data.moods[d].join(", ")}`);
        if (has("symptoms") && (data.symptoms[d] || []).length) bits.push(data.symptoms[d].join(", "));
        if (has("fluid") && data.discharge[d]) bits.push(`fluid ${data.discharge[d]}`);
        if (has("bc") && data.bcLog[d]) bits.push("contraception taken");
        if (has("notes") && data.notes[d]) bits.push(`note: ${data.notes[d]}`);
        if (bits.length) L.push(`   ${prettyDate(d)} — ${bits.join("; ")}`);
      });
      L.push("");
    });
    L.push("Logged in Celeste. Estimates only, not a medical record.");
    return L.join("\n");
  };

  const save = (text, ext, type) => {
    try {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `celeste-report-${iso(new Date())}.${ext}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDone("Saved to your downloads.");
    } catch (err) { setDone("Could not save the file here — try copying instead."); }
  };

  const asCSV = () => {
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const cols = ["date"].concat(REPORT_FIELDS.filter((f) => has(f.id) && f.id !== "dates" && f.id !== "cycle").map((f) => f.label));
    const dates = loggedDates(data).filter((d) => d >= from);
    const rows = [cols.join(",")];
    dates.forEach((d) => {
      const r = [d];
      if (has("flow")) r.push(data.flows[d] || "");
      if (has("symptoms")) r.push((data.symptoms[d] || []).join("; "));
      if (has("mood")) r.push((data.moods[d] || []).join("; "));
      if (has("skin")) r.push((data.skin[d] || []).join("; "));
      if (has("sex")) r.push((data.sex[d] || []).join("; "));
      if (has("tests")) r.push([data.ovTest[d], data.pregTest[d]].filter(Boolean).join("; "));
      if (has("lifestyle")) r.push([data.weight[d] && `${data.weight[d]}kg`, data.temp[d] && `${data.temp[d]}C`,
        data.sleep[d] && `${data.sleep[d]}h`, data.water[d] && `${data.water[d]} glasses`].filter(Boolean).join("; "));
      if (has("fluid")) r.push(data.discharge[d] || "");
      if (has("bc")) r.push(data.bcLog[d] ? "taken" : "");
      if (has("notes")) r.push(data.notes[d] || "");
      rows.push(r.map(esc).join(","));
    });
    return rows.join("\n");
  };

  return (
    <div>
      <div className="ora-setgroup">How much</div>
      <div className="ora-card">
        <div className="ora-chips">
          {[3, 6, 9, 12, "all"].map((r) => (
            <button key={String(r)} className={`ora-chip${range === r ? " on" : ""}`} onClick={() => setRange(r)}>
              {r === "all" ? "All cycles" : `Last ${r}`}
            </button>
          ))}
        </div>
        <div className="ora-learnnote">
          {chosen.length ? `${chosen.length} ${chosen.length === 1 ? "cycle" : "cycles"} from ${prettyDate(from)}.` : "No cycles logged yet."}
        </div>
      </div>

      <div className="ora-setgroup">What to include</div>
      <div className="ora-card ora-setlist">
        {REPORT_FIELDS.map((f) => (
          <button className="ora-setrow" key={f.id} onClick={() => toggle(f.id)}>
            <span className="ora-setmain"><span className="ora-setlabel">{f.label}</span></span>
            <span className={`ora-box${has(f.id) ? " on" : ""}`}>{has(f.id) ? "✓" : ""}</span>
          </button>
        ))}
      </div>

      <div className="ora-setgroup">Send it</div>
      <div className="ora-card">
        <button className="ora-cta" onClick={() => save(build(), "txt", "text/plain")}>Download report</button>
        <button className="ora-widebtn" onClick={() => save(asCSV(), "csv", "text/csv")}>Download spreadsheet (CSV)</button>
        <button className="ora-widebtn" onClick={() => {
          try { navigator.clipboard.writeText(build()); setDone("Copied. Paste it anywhere."); }
          catch (err) { setDone("Clipboard blocked here."); }
        }}>Copy to clipboard</button>
        <a className="ora-widebtn" style={{ display: "block" }}
          href={`mailto:?subject=${encodeURIComponent("My cycle report")}&body=${encodeURIComponent(build().slice(0, 1500))}`}>
          Email it
        </a>
        {done && <div className="ora-learnnote">{done}</div>}
      </div>

      <div className="ora-card">
        <div className="ora-cardhead">Preview</div>
        <pre className="ora-pre">{build().split("\n").slice(0, 14).join("\n")}</pre>
      </div>
    </div>
  );
}

/* --------------------------- version history --------------------------- */
function ChangelogPage() {
  const [open, setOpen] = useState(CHANGELOG[0].v);
  const label = { new: t("chNew"), better: t("chBetter"), fix: t("chFix") };
  return (
    <div>
      <p className="ora-lead">{t("changelogLead")}</p>
      {CHANGELOG.map((rel, i) => {
        const isOpen = open === rel.v;
        return (
          <div className={`ora-acc${isOpen ? " open" : ""}${i === 0 ? " current" : ""}`} key={rel.v}>
            <button className="ora-acchead" onClick={() => setOpen(isOpen ? null : rel.v)}>
              <span>
                <span className="ora-accname">
                  {rel.v}{i === 0 && <em> · {t("current")}</em>}
                </span>
                <span className="ora-acctag">{longDate(rel.date)} {fromISO(rel.date).getFullYear()}</span>
              </span>
              <span className="ora-chev">{isOpen ? "–" : "+"}</span>
            </button>
            {isOpen && (
              <div className="ora-accbody">
                {rel.notes.map((n, k) => (
                  <div className="ora-chrow" key={k}>
                    <span className={`ora-chtag ${n.t}`}>{label[n.t]}</span>
                    <span className="ora-chtext">{n.x}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- bug / feedback --------------------------- */
function MessagePage({ kind }) {
  const [text, setText] = useState("");
  const subject = kind === "bug" ? "Celeste bug report" : "Celeste feedback";
  return (
    <div>
      <p className="ora-lead">
        {kind === "bug"
          ? "What went wrong, and what were you doing just before? Screenshots help if you have them."
          : "What would make Celeste more useful to you? Anything missing, anything in the way?"}
      </p>
      <div className="ora-card">
        <textarea className="ora-textarea" rows={7} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={kind === "bug" ? "The calendar showed the wrong month after…" : "I'd love to be able to…"} />
        <a className={`ora-cta${text.trim() ? "" : " disabled"}`} style={{ display: "block", marginTop: 12 }}
          href={text.trim() ? `mailto:hello@celeste.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : undefined}>
          Send
        </a>
      </div>
      <div className="ora-note">Nothing from your logs is attached. Only what you type here is sent.</div>
    </div>
  );
}

/* ================================= css ================================= */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');

.ora-root{
  --rose:#c54b8c; --pink:#fb74a8; --light:#fdb9d1;
  --ink:#38202c; --mauve:#8d6b79; --petal:#f4e0e8; --paper:#fdf7f9; --card:#fff;
  --soft:#faf1f5; --soft2:#f3e3ea; --track:#f2e2ea; --text2:#5a4450;
  --line:#f0dbe4; --tabbg:rgba(253,247,249,.94); --shell:radial-gradient(120% 60% at 50% 0%, #fceef4 0%, #f6eaf0 60%, #f2e6ec 100%);
  --hero:linear-gradient(160deg,#fff 0%,#fdeff5 100%);
  --display:'Fraunces','Iowan Old Style',Georgia,serif;
  --body:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;
  font-family:var(--body); color:var(--ink);
  background:var(--shell);
  height:100dvh; min-height:100dvh; overflow:hidden;
  display:flex; justify-content:center; -webkit-font-smoothing:antialiased;
}
.ora-root *{box-sizing:border-box;}
.ora-root :where(button){font-family:inherit;color:inherit;cursor:pointer;border:none;background:none;padding:0;text-align:left;}
.ora-root :where(a){color:inherit;text-decoration:none;}
.ora-root button:focus-visible,.ora-root input:focus-visible,.ora-root select:focus-visible,.ora-root textarea:focus-visible{outline:2px solid var(--rose);outline-offset:2px;border-radius:8px;}
.ora-root p{margin:0;}
.ora-root h2{margin:0;}
.ora-root ul{margin:0;padding:0;list-style:none;}

.ora-phone{position:relative;width:100%;max-width:430px;height:100dvh;background:var(--paper);
  display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 60px rgba(197,75,140,.14);}
@media (min-width:520px){.ora-phone{height:calc(100dvh - 48px);margin:24px 0;border-radius:30px;}}

.ora-top{flex:none;padding:22px 22px 8px;display:flex;align-items:baseline;justify-content:space-between;}
.ora-mark{font-family:var(--display);font-size:26px;font-weight:600;letter-spacing:-.02em;color:var(--rose);}
.ora-mark span{color:var(--pink);}
.ora-mark{background:none;padding:0;}
.ora-mark .ora-ver{font-family:var(--body);font-style:normal;font-size:9px;font-weight:600;
  letter-spacing:.06em;color:var(--mauve);margin-left:5px;vertical-align:5px;}
.ora-datestamp{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mauve);}
.ora-scroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;padding:0 22px 112px;}

.ora-alert{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--card);
  border-left:3px solid var(--pink);border-radius:12px;padding:12px 14px;margin:10px 0;
  box-shadow:0 2px 10px rgba(197,75,140,.07);}
.ora-alerttext{font-size:13.5px;font-weight:600;}
.ora-alertsub{font-size:11.5px;color:var(--mauve);margin-top:2px;}
.ora-alertbtn{background:var(--rose);color:#fff;font-size:12px;font-weight:600;padding:8px 12px;border-radius:10px;white-space:nowrap;}

.ora-dialwrap{position:relative;margin:10px auto 0;width:272px;max-width:100%;aspect-ratio:1;}
.ora-dialsvg{display:block;width:100%;height:100%;}
.ora-dialsvg.live{touch-action:none;cursor:grab;}
.ora-dialsvg.live:active{cursor:grabbing;}
.ora-dialtick{font-family:var(--body);font-size:8px;font-weight:600;letter-spacing:.18em;fill:var(--mauve);opacity:.55;}
.ora-tick{animation:oraTick .55s cubic-bezier(.2,.9,.3,1) both;}
@keyframes oraTick{from{opacity:0;transform:scale(.82);transform-origin:130px 130px;}to{opacity:1;transform:scale(1);}}
.ora-dial-centre{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;}
.ora-dayword{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mauve);margin-bottom:6px;}
.ora-daynum{font-family:var(--display);font-size:66px;line-height:.86;font-weight:600;letter-spacing:-.03em;color:var(--rose);}
.ora-dialphase{display:flex;align-items:center;gap:6px;margin-top:12px;padding:5px 12px;border-radius:20px;
  background:var(--card);font-size:11.5px;font-weight:600;box-shadow:0 2px 8px rgba(197,75,140,.1);}
.ora-dialphase i{width:7px;height:7px;border-radius:50%;flex:none;}
.ora-dialphase.muted{color:var(--mauve);font-weight:500;box-shadow:none;background:transparent;}

.ora-previewbar{display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px;
  margin:18px 0 20px;padding:12px 16px;border-radius:14px;background:var(--card);font-size:13px;font-weight:600;
  box-shadow:0 0 0 1.5px var(--pink),0 2px 10px rgba(197,75,140,.08);}
.ora-previewback{color:var(--rose);font-weight:500;font-size:12.5px;white-space:nowrap;}
.ora-headline{font-family:var(--display);font-size:27px;font-weight:600;letter-spacing:-.02em;text-align:center;margin:20px 0 4px;}
.ora-sub{text-align:center;font-size:13px;color:var(--mauve);margin-bottom:20px;}

.ora-card{background:var(--card);border-radius:20px;padding:18px;box-shadow:0 2px 14px rgba(197,75,140,.07);margin-bottom:14px;}
.ora-cardhead{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--mauve);margin-bottom:14px;}
.ora-h2{font-family:var(--display);font-size:21px;font-weight:600;letter-spacing:-.02em;margin:26px 0 6px;}
.ora-h2.first{margin-top:14px;}
.ora-lead{font-size:13px;color:var(--mauve);line-height:1.6;margin-bottom:12px;}
.ora-body{font-size:13.5px;line-height:1.65;color:var(--text2);}

.ora-flowrow{display:flex;gap:8px;}
.ora-flowbtn{flex:1;padding:13px 6px;border-radius:14px;background:var(--soft);font-size:13px;font-weight:500;
  transition:background .12s ease,transform .12s ease;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;}
.ora-flowbtn:active{transform:scale(.96);}
.ora-flowbtn.on{background:var(--rose);color:#fff;}
.ora-drops{display:flex;gap:2px;}
.ora-drop{width:5px;height:9px;border-radius:0 60% 60% 60%;transform:rotate(45deg);background:var(--light);}
.ora-flowbtn.on .ora-drop{background:var(--card);opacity:.45;}
.ora-flowbtn.on .ora-drop.f{opacity:1;}
.ora-widebtn{display:block;width:100%;margin-top:8px;padding:13px;border-radius:14px;background:var(--soft);
  font-size:13px;font-weight:500;color:var(--rose);text-align:center;}
.ora-pillbtn{display:flex;align-items:center;gap:10px;width:100%;margin-top:8px;padding:13px 14px;
  border-radius:14px;background:var(--soft);font-size:13px;font-weight:500;}
.ora-pillbtn.on{background:var(--rose);color:#fff;}
.ora-check{width:19px;height:19px;border-radius:6px;border:1.5px solid var(--light);display:grid;place-items:center;font-size:12px;flex:none;}
.ora-pillbtn.on .ora-check{background:var(--card);color:var(--rose);border-color:#fff;font-weight:700;}

.ora-chart{margin-bottom:14px;}
.ora-chartaxis{display:flex;justify-content:space-between;font-size:10px;color:var(--mauve);margin-top:2px;}
.ora-hlist{display:flex;flex-direction:column;gap:9px;}
.ora-hrow{display:flex;align-items:center;gap:10px;width:100%;}
.ora-hname{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;width:88px;flex:none;}
.ora-hname i{width:8px;height:8px;border-radius:50%;flex:none;}
.ora-hname.big{font-size:15px;font-weight:600;margin-bottom:8px;width:auto;}
.ora-hbar{flex:1;height:7px;border-radius:4px;background:var(--track);overflow:hidden;display:block;}
.ora-hbar span{display:block;height:100%;border-radius:4px;transition:width .3s ease;}
.ora-hval{width:38px;flex:none;text-align:right;font-size:12px;color:var(--mauve);font-variant-numeric:tabular-nums;}
.ora-hval em{font-style:normal;margin-left:2px;color:var(--rose);}
.ora-hrow.open .ora-hname{color:var(--rose);}
.ora-hdetail{margin-top:14px;padding-top:14px;border-top:1px solid var(--petal);font-size:13px;line-height:1.65;color:var(--text2);}
.ora-hdetail p+p{margin-top:8px;}
.ora-hnow strong{color:var(--rose);}

.ora-youtag{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--rose);font-weight:600;margin-bottom:9px;}
.ora-youtag.muted{color:var(--mauve);font-weight:500;}
.ora-hormoneline{font-size:13px;line-height:1.6;color:var(--rose);margin-bottom:10px;font-weight:500;}
.ora-bullets li{font-size:13.5px;line-height:1.6;color:var(--text2);padding-left:16px;position:relative;margin-bottom:7px;}
.ora-bullets li:before{content:"";position:absolute;left:2px;top:8px;width:5px;height:5px;border-radius:50%;background:var(--petal);}
.ora-bullets.mine li:before{background:var(--pink);}
.ora-bullets li strong{color:var(--ink);font-weight:600;}
.ora-divider{height:1px;background:var(--petal);margin:14px 0;}
.ora-learnnote{font-size:12.5px;line-height:1.6;color:var(--mauve);background:var(--soft);border-radius:12px;padding:12px 14px;margin-top:4px;}
.ora-flag{font-size:12px;line-height:1.6;color:var(--mauve);border-left:2px solid var(--light);padding:2px 0 2px 12px;margin-top:14px;}
.ora-sublab{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mauve);margin:18px 0 9px;}

.ora-stats{display:flex;gap:12px;}
.ora-stat{flex:1;background:var(--card);border-radius:20px;padding:16px 14px;box-shadow:0 2px 14px rgba(197,75,140,.07);}
.ora-statnum{font-family:var(--display);font-size:30px;font-weight:600;color:var(--rose);letter-spacing:-.02em;}
.ora-statlab{font-size:11px;color:var(--mauve);margin-top:3px;line-height:1.4;}
.ora-tune{background:var(--card);border-radius:20px;padding:16px 18px;margin-top:14px;box-shadow:0 2px 14px rgba(197,75,140,.07);}
.ora-tunehead{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;}
.ora-tunehead span:first-child{font-weight:600;color:var(--rose);}
.ora-tunehead span:last-child{color:var(--mauve);}
.ora-tunebar{display:flex;gap:4px;}
.ora-tunebar span{flex:1;height:4px;border-radius:2px;background:var(--track);}
.ora-tunebar span.on{background:var(--pink);}
.ora-tunenote{font-size:12px;color:var(--mauve);line-height:1.6;margin-top:10px;}
.ora-note{font-size:11px;color:var(--mauve);text-align:center;line-height:1.7;margin:20px 4px 0;}

.ora-calbar{display:flex;align-items:center;justify-content:space-between;margin:8px 0 4px;}
.ora-caltitle{font-family:var(--display);font-size:22px;font-weight:600;letter-spacing:-.02em;}
.ora-arrow{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--rose);
  font-size:17px;background:var(--card);box-shadow:0 2px 8px rgba(197,75,140,.1);}
.ora-segrow{display:flex;justify-content:flex-end;margin:12px 0 2px;}
.ora-seg{display:inline-flex;background:var(--soft2);border-radius:10px;padding:2.5px;}
.ora-segbtn{padding:6px 15px;border-radius:8px;font-size:12px;font-weight:500;color:var(--mauve);text-align:center;}
.ora-segbtn.on{background:var(--card);color:var(--rose);font-weight:600;box-shadow:0 1px 4px rgba(197,75,140,.12);}
.ora-dow{display:grid;grid-template-columns:repeat(7,1fr);margin:14px 0 6px;}
.ora-dow span{text-align:center;font-size:10px;letter-spacing:.1em;color:var(--mauve);text-transform:uppercase;}
.ora-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
.ora-cell{aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:500;position:relative;}
.ora-cell.empty{visibility:hidden;}
.ora-cell.light{background:var(--light);}
.ora-cell.medium{background:var(--pink);color:#fff;}
.ora-cell.heavy{background:var(--rose);color:#fff;}
.ora-cell.predicted{border:1.5px dashed var(--pink);color:var(--pink);}
.ora-cell.today{box-shadow:0 0 0 1.5px var(--ink);}
.ora-cell.dim{color:#c8b0bb;}
.ora-pip{width:4px;height:4px;border-radius:50%;position:absolute;bottom:6px;}
.ora-pip.fertile{background:var(--pink);opacity:.5;}
.ora-pip.ovulation{width:7px;height:7px;border:1.5px solid var(--pink);background:var(--card);}
.ora-note-dot{position:absolute;top:5px;right:7px;width:4px;height:4px;border-radius:50%;background:var(--ink);opacity:.5;}
.ora-legend{display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:20px;}
.ora-leg{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--mauve);}
.ora-swatch{width:12px;height:12px;border-radius:50%;flex:none;}
.ora-year{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px;}
.ora-mini{background:var(--card);border-radius:14px;padding:9px 7px 10px;box-shadow:0 2px 10px rgba(197,75,140,.06);}
.ora-mini.now{box-shadow:0 0 0 1.5px var(--pink),0 2px 10px rgba(197,75,140,.1);}
.ora-mininame{font-size:10.5px;font-weight:600;color:var(--rose);margin-bottom:6px;letter-spacing:.04em;}
.ora-minigrid{display:grid;grid-template-columns:repeat(7,1fr);gap:1.5px;}
.ora-minicell{aspect-ratio:1;border-radius:50%;}
.ora-minicell.light{background:var(--light);}
.ora-minicell.medium{background:var(--pink);}
.ora-minicell.heavy{background:var(--rose);}
.ora-minicell.predicted{background:var(--petal);}
.ora-minicell.blank{opacity:0;}

.ora-acc{background:var(--card);border-radius:18px;margin-bottom:10px;overflow:hidden;box-shadow:0 2px 12px rgba(197,75,140,.06);}
.ora-chrow{display:flex;gap:10px;align-items:flex-start;margin-bottom:11px;}
.ora-chtag{flex:none;font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  padding:4px 8px;border-radius:7px;margin-top:1px;min-width:62px;text-align:center;}
.ora-chtag.new{background:var(--rose);color:#fff;}
.ora-chtag.better{background:var(--pink);color:#fff;}
.ora-chtag.fix{background:var(--soft2);color:var(--rose);}
.ora-chtext{font-size:13px;line-height:1.6;color:var(--text2);}
.ora-acc.current{box-shadow:0 0 0 1.5px var(--pink),0 2px 12px rgba(197,75,140,.08);}
.ora-acchead{display:flex;align-items:center;justify-content:space-between;width:100%;padding:15px 18px;}
.ora-accname{display:block;font-size:15px;font-weight:600;}
.ora-accname em{font-style:normal;font-weight:500;color:var(--rose);font-size:12.5px;}
.ora-acctag{display:block;font-size:11.5px;color:var(--mauve);margin-top:2px;}
.ora-chev{color:var(--rose);font-size:19px;line-height:1;}
.ora-accbody{padding:0 18px 18px;}

.ora-hist{padding:6px 18px;}
.ora-histrow{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--petal);}
.ora-histrow:last-child{border-bottom:none;}
.ora-histdate{font-size:14px;font-weight:600;}
.ora-histsub{font-size:11.5px;color:var(--mauve);margin-top:2px;}
.ora-histlen{font-size:12.5px;color:var(--rose);font-weight:500;}

.ora-chips{display:flex;flex-wrap:wrap;gap:7px;}
.ora-chip{padding:9px 13px;border-radius:11px;background:var(--soft);font-size:12.5px;font-weight:500;transition:background .12s ease;}
.ora-chip.on{background:var(--rose);color:#fff;}
.ora-field{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0 4px;}
.ora-field label{font-size:13.5px;font-weight:500;}
.ora-field input,.ora-field select{font-family:inherit;font-size:13px;color:var(--rose);font-weight:500;
  background:var(--soft);border:none;border-radius:10px;padding:9px 11px;}
.ora-textarea{width:100%;font-family:inherit;font-size:13.5px;line-height:1.6;color:var(--ink);
  background:var(--soft);border:none;border-radius:14px;padding:13px;resize:vertical;}
.ora-textarea::placeholder{color:#bda3ae;}
.ora-toggle{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;
  padding:13px 0;border-bottom:1px solid var(--petal);}
.ora-toggle.off{opacity:.45;cursor:default;}
.ora-togglelabel{display:block;font-size:13.5px;font-weight:500;}
.ora-togglesub{display:block;font-size:11.5px;color:var(--mauve);margin-top:3px;line-height:1.5;}
.ora-switch{width:44px;height:26px;border-radius:14px;background:var(--track);flex:none;position:relative;transition:background .18s ease;}
.ora-switch i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--card);
  box-shadow:0 1px 3px rgba(56,32,44,.2);transition:transform .18s ease;}
.ora-toggle.on .ora-switch{background:var(--rose);}
.ora-toggle.on .ora-switch i{transform:translateX(18px);}
.ora-kv{display:flex;justify-content:space-between;font-size:13.5px;padding:10px 0;border-bottom:1px solid var(--petal);}
.ora-kv span{color:var(--mauve);}
.ora-kv:last-of-type{border-bottom:none;margin-bottom:6px;}
.ora-danger{display:block;width:100%;margin-top:10px;padding:13px;border-radius:14px;background:var(--soft);
  color:var(--rose);font-size:13px;font-weight:600;text-align:center;flex:1;}
.ora-cta{display:block;width:100%;padding:16px;border-radius:16px;background:var(--rose);color:#fff;
  font-size:15px;font-weight:600;text-align:center;box-shadow:0 6px 18px rgba(197,75,140,.28);}
.ora-cta:active{transform:scale(.98);}

.ora-empty{text-align:center;padding:10px 6px 0;}
.ora-emptytitle{font-family:var(--display);font-size:21px;font-weight:600;margin-bottom:8px;}
.ora-emptybody{font-size:13.5px;color:var(--mauve);line-height:1.65;margin-bottom:22px;}

.ora-veil{position:absolute;inset:0;background:rgba(56,32,44,.38);z-index:34;animation:oraFade .18s ease;
  backdrop-filter:blur(2px);}
.ora-sheet{position:absolute;left:0;right:0;bottom:0;z-index:35;max-height:86%;display:flex;flex-direction:column;
  background:var(--paper);border-radius:26px 26px 0 0;padding:20px 22px 24px;
  box-shadow:0 -8px 30px rgba(56,32,44,.16);animation:oraUp .22s cubic-bezier(.2,.8,.3,1);}
.ora-sheettop{flex:none;display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:6px;}
.ora-sheet.tall{height:86%;}
.ora-sheet .ora-weekwrap{flex:none;margin-top:4px;}
.ora-sheet .ora-cta{flex:none;margin-top:10px;}
.ora-sheettitle{font-family:var(--display);font-size:20px;font-weight:600;}
.ora-sheetsub{font-size:12px;color:var(--mauve);margin-top:2px;}
.ora-close{width:30px;height:30px;border-radius:50%;background:var(--soft2);color:var(--mauve);display:grid;place-items:center;font-size:12px;flex:none;}
.ora-sheetscroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;padding-bottom:16px;margin:0 -4px;padding-left:4px;padding-right:4px;}
@keyframes oraUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
@keyframes oraFade{from{opacity:0;}to{opacity:1;}}

.ora-tabs{position:absolute;left:0;right:0;bottom:0;z-index:30;display:flex;background:var(--tabbg);
  backdrop-filter:blur(12px);border-top:1px solid var(--petal);padding:10px 0 calc(10px + env(safe-area-inset-bottom));}
.ora-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:10.5px;
  letter-spacing:.06em;color:var(--mauve);padding:4px 0;text-align:center;}
.ora-tab.on{color:var(--rose);font-weight:600;}
.ora-tab svg{display:block;}
.ora-tab.centre{gap:6px;}
.ora-tabknob{width:40px;height:40px;border-radius:14px;background:var(--rose);display:grid;place-items:center;
  margin-top:-14px;box-shadow:0 5px 14px rgba(197,75,140,.34);transition:transform .14s ease;}
.ora-tab.centre:active .ora-tabknob{transform:scale(.93);}
.ora-tab.centre.on .ora-tabknob{background:var(--ink);}

/* calendar peek */
.ora-hint{font-size:11.5px;color:var(--mauve);text-align:center;margin-top:22px;opacity:.8;}
.ora-cell.picked{box-shadow:0 0 0 2px var(--rose);}
.ora-peek{background:var(--card);border-radius:18px;padding:16px 18px;margin-top:20px;
  box-shadow:0 2px 14px rgba(197,75,140,.09);animation:oraFade .16s ease;}
.ora-peektop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.ora-peekdate{font-size:14.5px;font-weight:600;}
.ora-peeksub{font-size:11.5px;color:var(--mauve);margin-top:2px;}
.ora-peekempty{font-size:12.5px;color:var(--mauve);margin-top:12px;}
.ora-peekrows{margin-top:12px;}
.ora-peekrow{display:flex;gap:14px;justify-content:space-between;font-size:12.5px;padding:5px 0;}
.ora-peekrow span{color:var(--mauve);flex:none;}
.ora-peekrow strong{font-weight:500;text-align:right;}
.ora-peekrow strong.hot{color:var(--rose);font-weight:600;text-transform:capitalize;}
.ora-peeknote{font-size:12.5px;line-height:1.6;color:var(--text2);background:var(--soft);border-radius:10px;padding:10px 12px;margin-top:10px;}
.ora-peekedit{width:100%;margin-top:14px;padding:11px;border-radius:12px;background:var(--soft);
  color:var(--rose);font-size:12.5px;font-weight:600;text-align:center;}

/* log tab */
.ora-datebar{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:18px;padding:12px 10px;
  box-shadow:0 2px 14px rgba(197,75,140,.07);}
.ora-datepick{flex:1;position:relative;text-align:center;cursor:pointer;}
.ora-datebig{display:block;font-family:var(--display);font-size:19px;font-weight:600;letter-spacing:-.02em;}
.ora-datesub{display:block;font-size:11px;color:var(--mauve);margin-top:2px;}
.ora-datepick input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}
.ora-quickdates{display:flex;gap:7px;margin-top:10px;}
.ora-savedline{font-size:11.5px;color:var(--mauve);text-align:center;margin-top:2px;}
.ora-sublab.first{margin-top:0;}

/* past logs */
.ora-logrow{display:flex;align-items:center;gap:10px;width:100%;padding:13px 0;border-bottom:1px solid var(--petal);}
.ora-logrow:last-of-type{border-bottom:none;}
.ora-logmain{flex:1;min-width:0;}
.ora-logmain .ora-histsub{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ora-logmain .ora-histdate{display:block;}
.ora-flowtag{font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;padding:4px 8px;
  border-radius:7px;flex:none;background:var(--light);color:var(--ink);}
.ora-flowtag.medium{background:var(--pink);color:#fff;}
.ora-flowtag.heavy{background:var(--rose);color:#fff;}
.ora-showall{width:100%;padding:13px 0 6px;font-size:12.5px;font-weight:600;color:var(--rose);text-align:center;}
.ora-mini.picked{box-shadow:0 0 0 2px var(--rose),0 2px 10px rgba(197,75,140,.1);}
.ora-cyclewrap{border-bottom:1px solid var(--petal);}
.ora-cyclewrap:last-of-type{border-bottom:none;}
.ora-cyclerow{display:flex;align-items:center;gap:10px;width:100%;padding:14px 0;}
.ora-cyclelen{font-size:11.5px;color:var(--mauve);text-align:right;flex:none;line-height:1.35;}
.ora-cyclelen strong{display:block;font-size:15px;color:var(--rose);font-weight:600;}
.ora-cyclelen em{font-style:normal;color:var(--rose);font-weight:500;}
.ora-cycledays{padding:2px 0 12px 12px;border-left:2px solid var(--petal);margin:0 0 4px 4px;}
.ora-cycledays .ora-logrow{padding:10px 0;}
.ora-cycledays .ora-histdate{font-size:13px;}
.ora-cycledays .ora-peekempty{margin:4px 0 0;}

/* ---------- you hub ---------- */
.ora-hero{background:var(--hero);border-radius:24px;padding:18px;
  margin-top:14px;box-shadow:0 3px 18px rgba(197,75,140,.1);}
.ora-heromain{display:flex;align-items:center;gap:14px;width:100%;}
.ora-heroring{width:58px;height:58px;border-radius:50%;flex:none;display:grid;place-items:center;
  background:var(--card);box-shadow:0 0 0 2px var(--pink),0 3px 10px rgba(197,75,140,.16);}
.ora-heroday{font-family:var(--display);font-size:24px;font-weight:600;color:var(--rose);line-height:1;}
.ora-herotext{flex:1;min-width:0;}
.ora-heroname{display:block;font-size:16px;font-weight:600;letter-spacing:-.01em;}
.ora-herosub{display:block;font-size:12px;color:var(--rose);margin-top:3px;font-weight:500;}
.ora-quickgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:18px;}
.ora-quick{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:11px;
  color:var(--mauve);font-weight:500;text-align:center;}
.ora-quickicon{width:100%;aspect-ratio:1.15;max-height:52px;border-radius:15px;background:#fbeaf2;
  display:grid;place-items:center;transition:transform .12s ease;}
.ora-quick:active .ora-quickicon{transform:scale(.94);}

.ora-tilecard{background:var(--card);border-radius:24px;padding:20px 14px 16px;margin-top:14px;
  box-shadow:0 2px 14px rgba(197,75,140,.07);}
.ora-tilegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 6px;}
.ora-tile{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;}
.ora-tileicon{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;transition:transform .12s ease;}
.ora-tile:active .ora-tileicon{transform:scale(.93);}
.ora-tilelabel{font-size:11.5px;color:var(--ink);font-weight:500;line-height:1.35;}
.ora-tilefoot{display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--petal);}
.ora-tilefoot .ora-widebtn{flex:1;}

/* ---------- sub-pages ---------- */
.ora-pagehead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 16px;}
.ora-pagetitle{font-family:var(--display);font-size:20px;font-weight:600;letter-spacing:-.02em;text-align:center;flex:1;}
.ora-arrow.ghost{background:none;box-shadow:none;}
.ora-add{width:34px;height:34px;border-radius:50%;background:var(--rose);color:#fff;font-size:20px;
  display:grid;place-items:center;flex:none;box-shadow:0 3px 10px rgba(197,75,140,.3);line-height:1;}
.ora-sub-page{animation:oraSlide .2s ease;}
@keyframes oraSlide{from{opacity:0;transform:translateX(14px);}to{opacity:1;transform:none;}}

/* ---------- cycle analysis ---------- */
.ora-swipe{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;
  margin:0 -22px 14px;padding:2px 22px 6px;-webkit-overflow-scrolling:touch;}
.ora-statcard{flex:0 0 82%;scroll-snap-align:start;border-radius:20px;padding:18px;}
.ora-statcard.rose{background:#fbe0ea;}
.ora-statcard.pink{background:#fdeaf2;}
.ora-statcardtitle{font-family:var(--display);font-size:19px;font-weight:600;letter-spacing:-.02em;}
.ora-statcardvar{font-size:12.5px;font-weight:600;color:var(--rose);margin:3px 0 14px;}
.ora-statline{display:flex;justify-content:space-between;align-items:center;background:var(--card);
  border-radius:12px;padding:11px 14px;font-size:13px;margin-bottom:8px;}
.ora-statline strong{font-size:17px;font-weight:600;}
.ora-statline.filled{background:var(--rose);color:#fff;}
.ora-statline.filled.dark{background:var(--ink);}
.ora-statcardnote{font-size:12px;line-height:1.6;color:var(--text2);margin-top:4px;}

.ora-trendhead{margin-bottom:12px;}
.ora-trendtitle{font-family:var(--display);font-size:19px;font-weight:600;letter-spacing:-.02em;}
.ora-trendtiles{display:flex;gap:10px;margin-bottom:16px;}
.ora-trendtile{flex:1;border-radius:14px;padding:13px 14px;}
.ora-trendtile.blue{background:#f6e9f0;}
.ora-trendtile.pinkt{background:#fdeaf2;}
.ora-trendtile span{display:block;font-size:11.5px;color:var(--mauve);}
.ora-trendtile strong{display:block;font-family:var(--display);font-size:21px;font-weight:600;margin-top:3px;letter-spacing:-.02em;}
.ora-axis{font-family:var(--body);font-size:9px;fill:var(--mauve);}
.ora-trendchart{margin-top:4px;}

.ora-pilltabs{display:flex;background:var(--soft2);border-radius:12px;padding:3px;margin-bottom:16px;}
.ora-pilltab{flex:1;padding:9px;border-radius:9px;font-size:13px;font-weight:500;color:var(--mauve);text-align:center;}
.ora-pilltab.on{background:var(--rose);color:#fff;font-weight:600;}

.ora-barrow{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.ora-barlabel{width:96px;flex:none;font-size:12.5px;font-weight:600;line-height:1.35;}
.ora-bartrack{flex:1;position:relative;height:26px;display:flex;align-items:center;}
.ora-barperiod{position:absolute;left:0;top:0;height:26px;min-width:34px;border-radius:13px;background:var(--pink);
  color:#fff;font-size:12px;font-weight:600;display:grid;place-items:center;z-index:2;}
.ora-barcycle{position:absolute;left:0;top:0;height:26px;border-radius:13px;background:var(--soft2);color:var(--mauve);
  font-size:11.5px;font-weight:600;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;z-index:1;}
.ora-barcycle.ghost{background:transparent;box-shadow:inset 0 0 0 1.5px var(--petal);}
.ora-barnow{position:absolute;right:0;font-size:11px;color:var(--mauve);}
.ora-edit{width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:50%;}

.ora-freqrow{display:flex;align-items:center;gap:10px;margin-bottom:9px;}
.ora-freqname{width:96px;flex:none;font-size:12.5px;}
.ora-freqbar{flex:1;height:7px;border-radius:4px;background:var(--track);overflow:hidden;}
.ora-freqbar i{display:block;height:100%;border-radius:4px;background:var(--pink);}
.ora-freqn{width:22px;text-align:right;font-size:11.5px;color:var(--mauve);}
.ora-notecard{display:block;width:100%;text-align:left;}
.ora-pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:1.7;
  color:var(--text2);background:var(--soft);border-radius:12px;padding:12px;overflow-x:auto;margin:0;white-space:pre;}

/* ---------- dark ---------- */
.ora-root.dark{
  --ink:#f6e8ef; --mauve:#ad8b9c; --petal:#3b2740; --paper:#180f1e; --card:#251733;
  --soft:#2f1e3b; --soft2:#372345; --track:#3a2745; --text2:#d6bccb; --line:#3a2745;
  --light:#8a4a68; --tabbg:rgba(24,15,30,.94);
  --shell:radial-gradient(120% 60% at 50% 0%, #2a1733 0%, #1e1226 60%, #170e1d 100%);
  --hero:linear-gradient(160deg,#2e1d3d 0%,#38213f 100%);
}
.ora-root.dark .ora-mark span{color:#ff8fbc;}
.ora-root.dark .ora-statcard.rose{background:#3a2038;}
.ora-root.dark .ora-statcard.pink{background:#33203a;}
.ora-root.dark .ora-statline{background:#1f1428;}
.ora-root.dark .ora-trendtile.blue,.ora-root.dark .ora-trendtile.pinkt{background:#31203a;}
.ora-root.dark .ora-tileicon{background:#3b2242 !important;}
.ora-root.dark .ora-tileicon svg{filter:brightness(1.6);}
.ora-root.dark .ora-quickicon{background:#33203c;}
.ora-root.dark .ora-heroring{background:#1f1428;}
.ora-root.dark .ora-arrow{background:var(--card);}

/* ---------- wallpapers ---------- */
.ora-phone:before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0;}
.ora-phone>*{position:relative;z-index:1;}
.ora-phone.wp-blush:before{opacity:1;background:radial-gradient(80% 40% at 80% 0%, rgba(251,116,168,.16), transparent 70%),
  radial-gradient(70% 40% at 10% 100%, rgba(197,75,140,.12), transparent 70%);}
.ora-phone.wp-petals:before{opacity:1;background-image:radial-gradient(circle, rgba(197,75,140,.13) 1.4px, transparent 1.5px);background-size:22px 22px;}
.ora-phone.wp-arc:before{opacity:1;background:
  radial-gradient(120% 60% at 50% -10%, rgba(251,116,168,.2), transparent 60%),
  radial-gradient(60% 30% at 50% 108%, rgba(197,75,140,.14), transparent 70%);}
.ora-phone.wp-aurora:before{opacity:1;background:
  radial-gradient(50% 34% at 20% 18%, rgba(251,116,168,.24), transparent 70%),
  radial-gradient(46% 30% at 82% 34%, rgba(197,75,140,.2), transparent 70%),
  radial-gradient(56% 34% at 44% 88%, rgba(253,185,209,.28), transparent 70%);
  background-size:180% 180%;animation:oraAurora 26s ease-in-out infinite alternate;}
.ora-phone.wp-drift:before{opacity:1;background-image:
  radial-gradient(circle at 20% 24%, rgba(197,75,140,.16) 0 42px, transparent 43px),
  radial-gradient(circle at 76% 58%, rgba(251,116,168,.16) 0 58px, transparent 59px),
  radial-gradient(circle at 42% 86%, rgba(253,185,209,.22) 0 34px, transparent 35px);
  animation:oraDrift 34s ease-in-out infinite alternate;}
@keyframes oraAurora{from{background-position:0% 0%;}to{background-position:100% 100%;}}
@keyframes oraDrift{from{transform:translate3d(0,0,0) scale(1);}to{transform:translate3d(0,-22px,0) scale(1.08);}}

/* ---------- settings ---------- */
.ora-topright{display:flex;align-items:center;gap:10px;}
.ora-gear{width:34px;height:34px;border-radius:50%;background:var(--card);display:grid;place-items:center;
  box-shadow:0 2px 8px rgba(197,75,140,.12);flex:none;}
.ora-gear:active{transform:scale(.94);}
.ora-settings{position:absolute;inset:0;z-index:50;background:var(--paper);display:flex;flex-direction:column;
  animation:oraSlide .2s ease;}
.ora-pagehead.sticky{margin:0;padding:18px 22px 12px;border-bottom:1px solid var(--petal);}
.ora-settingsscroll{flex:1;overflow-y:auto;padding:6px 22px 40px;}
.ora-setgroup{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--mauve);margin:22px 4px 8px;}
.ora-setlist{padding:2px 18px;}
.ora-setrow{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;
  padding:14px 0;border-bottom:1px solid var(--petal);text-decoration:none;color:inherit;}
.ora-setrow:last-child{border-bottom:none;}
.ora-setmain{flex:1;min-width:0;}
.ora-setlabel{display:block;font-size:14px;font-weight:500;}
.ora-setsub{display:block;font-size:11.5px;color:var(--mauve);margin-top:3px;line-height:1.45;}
.ora-ticked{color:var(--rose);font-weight:700;}
.ora-box{width:22px;height:22px;border-radius:7px;flex:none;display:grid;place-items:center;
  background:var(--soft);color:transparent;font-size:12px;font-weight:700;}
.ora-box.on{background:var(--rose);color:#fff;}

.ora-remcard{padding:16px 18px;}
.ora-remhead{display:flex;align-items:center;justify-content:space-between;gap:14px;}
.ora-remtitle{flex:1;min-width:0;text-align:left;}
.ora-rembody{margin-top:6px;padding-top:8px;border-top:1px solid var(--petal);}
.ora-preview{font-size:12.5px;line-height:1.6;color:var(--text2);background:var(--soft);
  border-radius:12px;padding:12px 14px;margin-top:10px;}
.ora-switch.btn{border:none;cursor:pointer;background:var(--track);}
.ora-switch.btn.on{background:var(--rose);}
.ora-switch.btn.on i{transform:translateX(18px);}
.ora-switch.btn.off{opacity:.4;}
.ora-inlineinput{flex:1;min-width:0;font-family:inherit;font-size:14px;font-weight:500;color:var(--ink);
  background:var(--soft);border:none;border-radius:10px;padding:10px 12px;}

.ora-wallgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.ora-wall{display:flex;flex-direction:column;gap:7px;text-align:center;}
.ora-wallswatch{display:block;width:100%;aspect-ratio:.8;border-radius:14px;background:var(--soft);
  box-shadow:inset 0 0 0 1.5px var(--track);}
.ora-wall.on .ora-wallswatch{box-shadow:0 0 0 2px var(--rose);}
.ora-walllabel{font-size:11.5px;font-weight:500;}
.ora-wallanim{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--rose);margin-top:-3px;}
.ora-wallswatch.wp-blush{background:radial-gradient(80% 50% at 70% 10%, #fb74a8 0%, transparent 70%),#fdf0f5;}
.ora-wallswatch.wp-petals{background-image:radial-gradient(circle, rgba(197,75,140,.4) 1.3px, transparent 1.4px);background-size:11px 11px;background-color:#fdf0f5;}
.ora-wallswatch.wp-arc{background:radial-gradient(120% 60% at 50% -20%, #fb74a8, transparent 62%),#fdf0f5;}
.ora-wallswatch.wp-aurora{background:radial-gradient(50% 40% at 20% 20%, #fb74a8, transparent 70%),radial-gradient(50% 40% at 80% 60%, #c54b8c, transparent 70%),#fdf0f5;}
.ora-wallswatch.wp-drift{background:radial-gradient(circle at 30% 30%, #c54b8c 0 16%, transparent 17%),radial-gradient(circle at 70% 68%, #fb74a8 0 20%, transparent 21%),#fdf0f5;}

/* widget previews */
.ora-widgetrow{display:flex;gap:12px;}
.ora-wsmall{flex:1;aspect-ratio:1;border-radius:22px;background:var(--card);padding:16px;
  display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 3px 14px rgba(197,75,140,.1);}
.ora-wsmall.rose{background:var(--rose);}
.ora-weyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mauve);}
.ora-weyebrow.light,.ora-wfoot.light{color:rgba(255,255,255,.8);}
.ora-wbig{font-family:var(--display);font-size:44px;font-weight:600;line-height:.9;color:var(--rose);letter-spacing:-.03em;}
.ora-wbig.light{color:#fff;}
.ora-wfoot{font-size:11.5px;color:var(--mauve);}
.ora-wmed{border-radius:22px;background:var(--card);padding:18px;box-shadow:0 3px 14px rgba(197,75,140,.1);}
.ora-wmedleft{margin-bottom:14px;}
.ora-wmedtitle{font-family:var(--display);font-size:19px;font-weight:600;letter-spacing:-.02em;margin:4px 0 3px;}
.ora-wstrip{display:flex;gap:5px;align-items:flex-end;height:26px;}
.ora-wtick{flex:1;height:12px;border-radius:4px;background:var(--track);}
.ora-wtick.bled{background:var(--rose);}
.ora-wtick.now{height:26px;background:var(--ink);}
.ora-wlarge{border-radius:22px;background:var(--card);padding:20px;box-shadow:0 3px 14px rgba(197,75,140,.1);}
.ora-wmonth{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
.ora-wcell{aspect-ratio:1;border-radius:50%;background:var(--track);}
.ora-wcell.bled{background:var(--rose);}
.ora-wcell.now{background:var(--ink);}
.ora-cta.disabled{opacity:.45;pointer-events:none;}


/* ---------- log: week strip ---------- */
.ora-logscreen{padding-top:4px;}
.ora-weekwrap{margin:8px 0 6px;}
.ora-weekbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.ora-weekmonth{font-family:var(--display);font-size:19px;font-weight:600;letter-spacing:-.02em;}
.ora-arrow.small{width:28px;height:28px;font-size:15px;}
.ora-week{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.ora-weekday{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0 7px;border-radius:14px;}
.ora-weekletter{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mauve);white-space:nowrap;}
.ora-weeknum{font-size:16px;font-weight:600;color:var(--mauve);width:32px;height:32px;border-radius:50%;
  display:grid;place-items:center;transition:background .14s ease;}
.ora-weekday.on .ora-weeknum{background:var(--rose);color:#fff;}
.ora-weekday.on .ora-weekletter{color:var(--rose);font-weight:700;}
.ora-weekdot{width:4px;height:4px;border-radius:50%;background:transparent;}
.ora-weekdot.has{background:var(--pink);}
.ora-logsub{font-size:12px;color:var(--mauve);text-align:center;margin:2px 0 14px;}

/* ---------- log: flow hero ---------- */
.ora-flowcard{background:linear-gradient(155deg,#fde9f1 0%,#fbdcea 100%);border-radius:22px;
  padding:18px;margin-bottom:12px;}
.ora-root.dark .ora-flowcard{background:linear-gradient(155deg,#3a2038 0%,#2e1b33 100%);}
.ora-flowcardhead{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;}
.ora-flowcardtitle{font-family:var(--display);font-size:22px;font-weight:600;letter-spacing:-.02em;}
.ora-clearlink{font-size:12px;font-weight:600;color:var(--rose);}
.ora-flowgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.ora-flowtile{background:var(--card);border-radius:16px;padding:14px 4px 11px;display:flex;
  flex-direction:column;align-items:center;gap:9px;font-size:12px;font-weight:600;text-align:center;
  transition:transform .12s ease,background .12s ease;}
.ora-flowtile:active{transform:scale(.95);}
.ora-flowtile.on{background:var(--rose);color:#fff;}
.ora-flowdrops{display:flex;gap:3px;height:16px;align-items:center;}
.ora-bigdrop{width:7px;height:12px;border-radius:0 60% 60% 60%;transform:rotate(45deg);background:var(--light);}
.ora-bigdrop.f{background:var(--rose);}
.ora-flowtile.on .ora-bigdrop{background:rgba(255,255,255,.4);}
.ora-flowtile.on .ora-bigdrop.f{background:#fff;}
.ora-nodrop{width:13px;height:13px;border-radius:50%;box-shadow:inset 0 0 0 1.8px var(--light);}
.ora-flowtile.on .ora-nodrop{box-shadow:inset 0 0 0 1.8px #fff;}

/* ---------- log: section cards ---------- */
.ora-logcard{background:var(--card);border-radius:22px;padding:16px 16px 14px;margin-bottom:12px;
  box-shadow:0 2px 12px rgba(197,75,140,.06);}
.ora-logcardhead{display:flex;align-items:center;gap:8px;margin-bottom:13px;}
.ora-logcardtitle{font-size:14.5px;font-weight:600;letter-spacing:-.01em;}
.ora-logcount{font-size:10.5px;font-weight:700;color:#fff;background:var(--pink);
  min-width:18px;height:18px;border-radius:9px;padding:0 6px;display:grid;place-items:center;}
.ora-pills{display:flex;flex-wrap:wrap;gap:7px;}
.ora-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 14px 7px 7px;border-radius:22px;
  background:var(--soft);font-size:12.5px;font-weight:500;transition:background .12s ease,transform .12s ease;}
.ora-pill:active{transform:scale(.96);}
.ora-pill.on{background:var(--rose);color:#fff;}
.ora-pillicon{width:26px;height:26px;border-radius:50%;background:var(--card);display:grid;place-items:center;flex:none;}
.ora-pill.on .ora-pillicon{background:rgba(255,255,255,.22);}
.ora-morelink{width:100%;margin-top:12px;padding:6px 0 2px;font-size:12.5px;font-weight:600;
  color:var(--rose);text-align:center;}
.ora-hint.left{text-align:left;margin:10px 0 0;}

/* ---------- log: lifestyle ---------- */
.ora-lifegrid{display:flex;flex-direction:column;}
.ora-liferow{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--petal);}
.ora-liferow:last-child{border-bottom:none;}
.ora-lifeicon{width:30px;height:30px;border-radius:50%;background:var(--soft);display:grid;place-items:center;flex:none;}
.ora-lifelabel{flex:1;font-size:13px;font-weight:500;}
.ora-liferow input{width:74px;font-family:inherit;font-size:14px;font-weight:600;color:var(--rose);
  background:var(--soft);border:none;border-radius:10px;padding:8px 10px;text-align:right;}
.ora-lifeunit{width:48px;font-size:11px;color:var(--mauve);}
.ora-counter{display:flex;align-items:center;gap:4px;}
.ora-counter button{width:28px;height:28px;border-radius:9px;background:var(--soft);color:var(--rose);
  font-size:15px;font-weight:600;display:grid;place-items:center;}
.ora-counter span{min-width:26px;text-align:center;font-size:14px;font-weight:600;}


/* ---------- partner ---------- */
.ora-pill.flat{background:var(--soft);padding:7px 14px;font-weight:500;cursor:default;}
.ora-readout{border-radius:22px;}
.ora-readout.preview{background:var(--soft);padding:14px;border-radius:22px;
  box-shadow:inset 0 0 0 1.5px var(--track);}
.ora-readout.preview .ora-logcard{box-shadow:none;}
.ora-readhero{background:linear-gradient(155deg,var(--rose) 0%,var(--pink) 100%);border-radius:22px;
  padding:22px 20px;color:#fff;margin-bottom:12px;}
.ora-readname{font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.85;}
.ora-readday{font-family:var(--display);font-size:40px;font-weight:600;letter-spacing:-.03em;line-height:1;margin-top:8px;}
.ora-readphase{font-size:14px;font-weight:500;opacity:.92;margin-top:6px;}
.ora-readflag{background:var(--card);border-left:3px solid var(--rose);border-radius:12px;padding:12px 14px;
  font-size:13px;font-weight:600;margin-bottom:12px;box-shadow:0 2px 10px rgba(197,75,140,.07);}
.ora-readflag.soft{border-left-color:var(--pink);font-weight:500;}
.ora-pre.code{font-size:9.5px;line-height:1.5;word-break:break-all;white-space:pre-wrap;max-height:96px;overflow:hidden;}
.ora-field input[type=text]{width:150px;text-align:right;}


/* ---------- import ---------- */
.ora-filebtn{display:block;width:100%;padding:14px;border-radius:14px;background:var(--soft);
  color:var(--rose);font-size:13.5px;font-weight:600;text-align:center;cursor:pointer;}
.ora-filebtn input{display:none;}
.ora-orline{font-size:11.5px;color:var(--mauve);text-align:center;margin:12px 0 10px;}


/* ---------- onboarding ---------- */
.ora-onboard{position:absolute;inset:0;z-index:70;background:var(--paper);display:flex;flex-direction:column;
  padding:22px 22px calc(24px + env(safe-area-inset-bottom));animation:oraFade .25s ease;}
.ora-onboard:before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(90% 45% at 50% -6%, rgba(251,116,168,.22), transparent 68%),
             radial-gradient(60% 32% at 12% 104%, rgba(197,75,140,.14), transparent 70%);}
.ora-onboard>*{position:relative;z-index:1;}
.ora-obtop{display:flex;align-items:center;gap:14px;padding-top:6px;}
.ora-obprogress{flex:1;}
.ora-obcount{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--mauve);margin-bottom:7px;}
.ora-obbar{height:4px;border-radius:3px;background:var(--track);overflow:visible;}
.ora-obbar span{display:block;height:100%;border-radius:3px;
  background:linear-gradient(90deg,var(--rose) 0%,var(--pink) 78%,#e59ad2 100%);
  box-shadow:0 0 10px rgba(251,116,168,.75),0 0 20px rgba(197,75,140,.35);
  transition:width .45s cubic-bezier(.3,.9,.3,1);animation:oraGlow 2.6s ease-in-out infinite;}
@keyframes oraGlow{
  0%,100%{box-shadow:0 0 8px rgba(251,116,168,.6),0 0 16px rgba(197,75,140,.28);}
  50%{box-shadow:0 0 14px rgba(251,116,168,.95),0 0 26px rgba(197,75,140,.45);}
}
.ora-obbody{flex:1;display:flex;flex-direction:column;padding-top:34px;overflow-y:auto;}
.ora-obwelcome{margin:auto 0;text-align:center;}
.ora-mark.big{font-size:44px;margin-bottom:18px;}
.ora-obtitle{font-family:var(--display);font-size:28px;font-weight:600;letter-spacing:-.03em;
  line-height:1.15;margin-bottom:10px;}
.ora-oblead{font-size:14px;line-height:1.65;color:var(--mauve);margin-bottom:26px;}
.ora-obwelcome .ora-cta{margin-top:8px;}
.ora-skip{display:block;width:100%;margin-top:12px;padding:12px;font-size:13px;font-weight:500;
  color:var(--mauve);text-align:center;}
.ora-obfoot{margin-top:auto;padding-top:26px;}
.ora-cta[disabled]{opacity:.35;pointer-events:none;}

.ora-obdate{display:block;position:relative;background:var(--card);border-radius:18px;padding:22px;
  text-align:center;box-shadow:0 2px 14px rgba(197,75,140,.08);cursor:pointer;}
.ora-obdatetext{font-family:var(--display);font-size:22px;font-weight:600;letter-spacing:-.02em;color:var(--rose);}
.ora-obdate input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}

.ora-stepper{display:flex;align-items:center;justify-content:center;gap:22px;background:var(--card);
  border-radius:20px;padding:22px;box-shadow:0 2px 14px rgba(197,75,140,.08);}
.ora-stepper.dim .ora-steppervalue{opacity:.35;}
.ora-stepper button{width:44px;height:44px;border-radius:50%;background:var(--soft);color:var(--rose);
  font-size:22px;font-weight:600;display:grid;place-items:center;flex:none;}
.ora-stepper button:active{transform:scale(.93);}
.ora-steppervalue{text-align:center;min-width:92px;}
.ora-steppervalue span{display:block;font-family:var(--display);font-size:46px;font-weight:600;
  line-height:1;letter-spacing:-.03em;color:var(--rose);}
.ora-steppervalue em{display:block;font-style:normal;font-size:11px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--mauve);margin-top:8px;}

.ora-oblist{display:flex;flex-direction:column;gap:9px;}
.ora-obopt{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;
  background:var(--card);border-radius:16px;padding:15px 16px;box-shadow:0 2px 10px rgba(197,75,140,.06);
  transition:box-shadow .14s ease;}
.ora-obopt.on{box-shadow:0 0 0 2px var(--rose),0 2px 10px rgba(197,75,140,.1);}
.ora-obopt.static{cursor:default;}
.ora-secondary{display:block;width:100%;margin-top:10px;padding:15px;border-radius:16px;
  background:var(--card);color:var(--rose);font-size:14px;font-weight:600;text-align:center;
  box-shadow:0 2px 12px rgba(197,75,140,.09);}
.ora-secondary:active{transform:scale(.98);}
.ora-partnerapp{position:absolute;inset:0;z-index:60;background:var(--paper);display:flex;
  flex-direction:column;animation:oraFade .25s ease;}
.ora-oblangbar{display:flex;justify-content:flex-end;padding-top:2px;}
.ora-langpill{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:20px;
  background:var(--card);font-size:12.5px;font-weight:600;color:var(--rose);
  box-shadow:0 2px 10px rgba(197,75,140,.1);}
.ora-langpill:active{transform:scale(.96);}


/* ---------- profile ---------- */
.ora-avatar{position:relative;display:inline-grid;place-items:center;border-radius:50%;flex:none;
  background:linear-gradient(155deg,#fde4ee 0%,#fbd3e4 100%);overflow:visible;}
.ora-root.dark .ora-avatar{background:linear-gradient(155deg,#3d2340 0%,#2d1a33 100%);}
.ora-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;}
.ora-avatarflower{display:grid;place-items:center;}
.ora-avatarbadge{position:absolute;right:-3px;bottom:-3px;min-width:22px;height:22px;padding:0 5px;
  border-radius:11px;background:var(--rose);color:#fff;font-size:11px;font-weight:700;
  display:grid;place-items:center;box-shadow:0 0 0 2.5px var(--card);}
.ora-profilehero{text-align:center;padding:12px 0 18px;}
.ora-avatarpick{display:inline-flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;}
.ora-avatarpick input{display:none;}
.ora-avataredit{font-size:12px;font-weight:600;color:var(--rose);}
.ora-profilehero .ora-clearlink{display:block;margin:12px auto 0;}
.ora-miniprofile{display:inline-flex;align-items:center;gap:8px;padding:4px 12px 4px 4px;border-radius:20px;
  background:var(--card);font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(197,75,140,.1);}
.ora-readavatar{display:block;margin-bottom:12px;}
.ora-readavatar .ora-avatar{box-shadow:0 0 0 2.5px rgba(255,255,255,.55);}


/* ---------- collapsible cycle history ---------- */
.ora-cycleday{padding:10px 0;border-bottom:1px solid var(--petal);}
.ora-cycleday:last-child{border-bottom:none;padding-bottom:2px;}
.ora-cycledaytop{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;}
.ora-cycledaytop .ora-histdate{font-size:12.5px;}
.ora-cycledaytop .ora-histsub{margin-top:0;}
.ora-pill.flat.hot{background:var(--rose);color:#fff;text-transform:capitalize;}
.ora-cycledays .ora-pills{gap:6px;}
.ora-cycledays .ora-pill{padding:5px 11px;font-size:11.5px;}
.ora-cycledays .ora-peeknote{margin-top:8px;}
.ora-cyclerow[aria-expanded="true"] .ora-histdate{color:var(--rose);}


/* ---------- decluttered today + log ---------- */
.ora-avgstrip{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:6px;
  font-size:12px;color:var(--mauve);}
.ora-avgstrip strong{font-family:var(--display);font-size:17px;font-weight:600;color:var(--rose);
  letter-spacing:-.02em;margin-right:2px;}
.ora-avgstrip i{width:3px;height:3px;border-radius:50%;background:var(--petal);flex:none;}
.ora-morecard{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;
  padding:15px;border-radius:22px;background:var(--card);font-size:13.5px;font-weight:600;
  color:var(--rose);margin-bottom:12px;box-shadow:0 2px 12px rgba(197,75,140,.06);}
.ora-morecard span{font-size:11px;font-weight:700;background:var(--soft);padding:3px 8px;border-radius:8px;}
.ora-morecard:active{transform:scale(.98);}

@media (prefers-reduced-motion:reduce){.ora-root *{animation:none!important;transition:none!important;}
.ora-phone:before{animation:none!important;}}
`;
