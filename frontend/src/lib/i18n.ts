/**
 * Polish UI strings for Kaffebar (Poland).
 */
export const t = {
  // App & nav
  appName: "Kaffebar",
  navOverview: "Home",
  navLighting: "Oświetlenie",
  navTemperature: "Temperatura",
  navHvac: "Klimatyzacja",
  navSettings: "Ustawienia",

  // Settings
  settingsTitle: "Ustawienia",
  settingsTheme: "Motyw",
  themeLight: "Jasny",
  themeDark: "Ciemny",
  themeSystem: "System",
  settingsWelcomeTitle: "Tytuł strony głównej",
  settingsWelcomeDesc: "Opis strony głównej",
  settingsSave: "Zapisz",
  settingsReset: "Przywróć domyślne",
  settingsSaved: "Zapisano",

  // Checklist
  checklistTitle: "Lista zadań",
  checklistAddPlaceholder: "Dodaj punkt…",
  checklistAdd: "Dodaj",
  checklistEmpty: "Brak punktów. Dodaj je poniżej.",
  checklistHelp: "Punkty wyświetlane na stronie głównej. Stan zaznaczenia resetuje się co godzinę.",

  // Header
  navMenuOpen: "Open menu",
  navMenuClose: "Close menu",
  statusOnline: "Połączono",
  statusOffline: "Rozłączono",
  goodbye: "Goodbye",
  demo: "Demo",

  // Overview
  welcomeTitle: "Witaj w Kaffebar",
  welcomeDesc:
    "Steruj oświetleniem, klimatem i urządzeniami z menu bocznego. Użyj scen poniżej, aby szybko otworzyć lub zamknąć bar.",
  lightsOn: (n: number) => (n === 1 ? "1 lampa włączona" : n < 5 ? `${n} lampy włączone` : `${n} lamp włączonych`),
  lightsOnShort: (n: number) => `${n} wł.`,

  // Scenes
  sceneSaveAs: "Zapisz jako scenę",
  sceneSave: "Zapisz scenę",
  sceneNamePlaceholder: "Nazwa sceny…",
  sceneApply: "Uruchom",
  scenesTitle: "Sceny",
  scenesEmpty: "Brak scen. Użyj „Zapisz jako scenę”, aby zapisać aktualny stan.",
  sceneReplaceWithCurrent: "Zastąp aktualnym stanem",
  sceneIcon: "Ikona",
  sceneColor: "Kolor",
  sceneColorNone: "Bez koloru",
  sceneEdit: "Edytuj",
  sceneDelete: "Usuń",
  sceneDeleteConfirm: (name: string) => `Usunąć scenę „${name}"?`,

  // View titles
  titleLighting: "Oświetlenie",
  titleTemperature: "Temperatura",
  titleHvac: "Klimatyzacja",

  // Light groups (section headers)
  lightGroupRoom: "Sala",
  lightGroupKaseton: "Kasetony",
  lightGroupCounter: "Bar",
  lightGroupBack: "Zaplecze",
  lightGroupOther: "Inne",

  // PIN lock
  pinLockTitle: "Wprowadź PIN",
  pinSetTitle: "Ustaw PIN",
  pinChangeTitle: "Zmień PIN",
  pinRemoveTitle: "Usuń PIN",
  pinEnterPrompt: "Wprowadź 4-cyfrowy PIN",
  pinConfirmPrompt: "Potwierdź PIN",
  pinCurrentPrompt: "Wprowadź aktualny PIN",
  pinWrong: "Nieprawidłowy PIN",
  pinMismatch: "PINy się nie zgadzają",
  pinSet: "Ustaw PIN",
  pinChange: "Zmień PIN",
  pinRemove: "Usuń PIN",
  pinRemoveConfirm: "Czy na pewno usunąć PIN?",
  pinLockSection: "Blokada PIN",

  // Goodbye modal
  turnAllOffTitle: "Wyłączyć wszystko?",
  turnAllOffDesc: "Spowoduje to wyłączenie wszystkich lamp i przełączników w Kaffebar.",
  cancel: "Anuluj",
  turnAllOff: "Wyłącz wszystko",

  // Temperature
  graphTitle24h: "Ostatnie 24 h — wewnątrz i na zewnątrz",
  graphInside: "Wewnątrz",
  graphOutside: "Na zewnątrz",
  lastHours: (h: number) => `Ostatnie ${h} godz.`,
  loading: "Ładowanie…",
  notEnoughData: "Za mało danych",
  viewHistory: "Zobacz historię",
  close: "Zamknij",
  failedToLoadHistory: "Nie udało się załadować historii",

  // States
  on: "Wł.",
  off: "Wył.",
  updating: "Aktualizacja…",
  unavailable: "Niedostępne",
  auto: "Auto",

  // HVAC / climate card
  tempCurrent: "Aktualna",
  tempTarget: "Cel",
  modeLabel: "Tryb",
  presetLabel: "Profil",

  // HVAC modes (display labels, kept in English)
  modeOff: "Off",
  modeAuto: "Auto",
  modeOptimal: "Optimal",
  modeComfort: "Comfort",

  // A11y
  ariaTurnOn: "Włącz",
  ariaTurnOff: "Wyłącz",
  ariaMoveUp: "Przenieś w górę",
  ariaMoveDown: "Przenieś w dół",
  ariaRemove: "Usuń",
  ariaDecreaseTemp: "Zmniejsz temperaturę",
  ariaIncreaseTemp: "Zwiększ temperaturę",

  // Light presets (RGBW)
  presetWarm: "Ciepły",
  presetCool: "Chłodny",
  presetWhite: "Biały",
  presetAmber: "Bursztyn",
  customColor: "Wybierz kolor",
  colorSlider: "Kolor",
  colorIntensity: "Intensywność koloru",
  whiteIntensity: "Intensywność bieli",

  // Empty state
  noEntities: "Brak jednostek na liście dozwolonych.",
  addEntitiesIn: "Dodaj jednostki w",

  // Errors (fallbacks shown in UI)
  errorCannotReach: "Nie można połączyć z Coffee API. Czy backend działa?",
  errorFailedToLoad: "Nie udało się załadować",
  errorShowingLastState: "Wyświetlany ostatni znany stan",
  errorToggleFailed: "Przełączanie nie powiodło się",
  errorSceneFailed: "Nie udało się uruchomić sceny",
  errorRequestFailed: (status: number) =>
    `Żądanie nie powiodło się (${status}). Czy Coffee API działa?`,
} as const;

export type T = typeof t;
