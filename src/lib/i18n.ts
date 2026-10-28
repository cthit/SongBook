// Ported from the old frontend/src/app/App.translations.json, [English, Swedish]

export type Language = 'en' | 'sv'
export const LANGUAGES: readonly Language[] = ['en', 'sv']
export const LANGUAGE_COOKIE = 'songbook_language'
/** Same localStorage key as the old frontend */
export const LANGUAGE_STORAGE_KEY = 'language'

const translations = {
  SignInWithGamma: ['Sign in', 'Logga in'],
  SignOut: ['Sign out', 'Logga ut'],
  ViewAccount: ['View account', 'Visa konto'],
  Contact: [
    'If this happens often, please send a mail with what you tried to do to digit@chalmers.it',
    'Om det här händer ofta, skicka ett mail till digit@chalmers.it med vad du försökte göra',
  ],
  ContactDigit: [
    'If you still think it is? Contact digIT@chalmers.it.',
    'Om du fortfarande tror att du har träffat rätt, kontaka digIT@chalmers.it.',
  ],
  YouDontHaveAccess: [
    'You do not have access to this page. Please contact digit@chalmers.it if you think this is a mistake.',
    'Du har inte tillgång till denna sida. Kontakta digit@chalmers.it om du tror det här är ett misstag.',
  ],
  InsufficientAccess: ['403 - Insufficient access', '403 - Otillräcklig tillgång'],
  SignInRequired: ['401 - Sign in required', '401 - Inloggning krävs'],
  SignInToContinue: [
    'You need to sign in with your Chalmers IT account to see this page.',
    'Du behöver logga in med ditt Chalmers IT-konto för att se den här sidan.',
  ],
  PageNotFound: ['404 - Page not found', '404 - Sida ej funnen'],
  SomethingWentWrong: ['500 - Something went wrong', '500 - Någonting gick fel'],
  AddSong: ['Add a song', 'Lägg till en sång'],
  EditSong: ['Edit song', 'Redigera låt'],
  EditSongHeader: ['Edit song', 'Redigera låt'],
  DeleteSong: ['Delete song', 'Ta bort låt'],
  DeleteSongConfirm: [
    'Are you sure you want to delete this song?',
    'Är du säker att du vill ta bort den här låten?',
  ],
  RefreshWebsite: ['Refresh website', 'Uppdatera hemsidan'],
  Back: ['Back', 'Tillbaka'],
  Close: ['Close', 'Stäng'],
  Save: ['Save', 'Spara'],
  Cancel: ['Cancel', 'Avbryt'],
  Delete: ['Delete', 'Ta bort'],
  Unknown: ['Unknown', 'Okänd'],
  FilterTag: ['Filter by tags', 'Filtrera med taggar'],
  FilterSearch: ['Search songs', 'Sök bland sångerna'],
  Browse: ['Welcome to ITs songbook', 'Välkommen till ITs sångbok'],
  Title: ['Title', 'Titel'],
  Author: ['Author', 'Författare'],
  Melody: ['Melody', 'Melodi'],
  Text: ['Lyrics', 'Text'],
  Tags: ['Tags', 'Taggar'],
  CantBeEmpty: ["This field can't be empty", 'Fältet får inte vara tomt'],
  AddSongSuccessful: ['Successfully added song', 'Lyckades lägga till sång'],
  AddSongFailed: ['Failed to add song', 'Misslyckades lägga till sång'],
  DeleteSongSuccessful: ['Successfully deleted song', 'Lyckades ta bort sången'],
  DeleteSongFailed: ['Failed to delete song', 'Misslyckades ta bort sången'],
  EditSongSuccessful: ['Successfully edited song', 'Lyckades redigera sången'],
  EditSongFailed: ['Failed to edit song', 'Misslyckades redigera sången'],
  MarkdownFormatSong: ['*Markdown is used for formatting*', '*Markdown används för formattering.*'],
  PreviewText: ['Preview text', 'Förhandsvisa låttext'],
  FormatSong: [
    '**Formatting of lyrics**\n\nThe lyrics uses Markdown to render. To ensure that the desired paragraph structure is achieved, make sure to understand the following syntax rules.\n\n* Double spaces at the end of a line gives a line break. Writing on a new line does not guarantee a line break.\n* A new paragraph is created by separating two lines by one or more empty lines.\n\n[Further reading on line breakes](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet#line-breaks)',
    '**Formattering av låttext**\n\nLåttexten använder sig av markdown. För att kunna formatera stycken som önskat rekommenderas att hålla koll på följande Markdownregler.\n\n* Dubbla mellanslag i slutet av en rad ger radbrytning i samma stycke. Bara en ny rad skapar då inte en radbrytning.\n* Nytt stycke skapas genom en eller flera tomma rader.\n\n[Vidare läsning om radbrytningar](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet#line-breaks)',
  ],
  SONG_TITLE_ALREADY_EXIST: [
    'There already exists a song with this title, try another one',
    'Det finns redan en sång med det här titeln, testa en annan',
  ],
  TAG_NAME_ALREADY_EXIST: [
    'There already exists a tag with this name',
    'Det finns redan en tagg med det här namnet',
  ],
  NoMatchingSongs: [
    'There are no songs that matches your filter, do you wish to reset them?',
    'Det finns inga sånger som matchar dina filter, vill du återställa dem?',
  ],
  ResetFilters: ['Reset filters', 'Återställ filter'],

  // Roles (issue #6)
  Admin: ['Admin', 'Admin'],
  Member: ['Member', 'Medlem'],

  // Hidden songs (issue #10)
  Hidden: ['Hidden', 'Dold'],
  HiddenHelp: [
    'Hidden songs are only visible to admins',
    'Dolda sånger syns bara för administratörer',
  ],

  // Tags (issue #13)
  ManageTags: ['Manage tags', 'Hantera taggar'],
  NewTag: ['New tag', 'Ny tagg'],
  CreateTag: ['Create tag', 'Skapa tagg'],
  CreateNewTag: ['Create a new tag', 'Skapa en ny tagg'],
  TagName: ['Name', 'Namn'],
  PrettyNameSv: ['Swedish name', 'Svenskt namn'],
  PrettyNameEn: ['English name', 'Engelskt namn'],
  Songs: ['Songs', 'Sånger'],
  Edit: ['Edit', 'Redigera'],
  DeleteTagConfirm: [
    'Are you sure you want to delete this tag? It is removed from all songs.',
    'Är du säker att du vill ta bort den här taggen? Den tas bort från alla sånger.',
  ],
  TagSaved: ['Tag saved', 'Taggen sparades'],
  TagDeleted: ['Tag deleted', 'Taggen togs bort'],
  NoTagsSelected: ['No tags selected', 'Inga taggar valda'],

  // Export (issue #21)
  Export: ['Export as markdown', 'Exportera som markdown'],

  // Suggestions (issues #8, #9)
  SuggestSong: ['Suggest a song', 'Föreslå en sång'],
  SuggestEdit: ['Suggest an edit', 'Föreslå en ändring'],
  SuggestEditHeader: ['Suggest an edit', 'Föreslå en ändring'],
  Suggestions: ['Suggestions', 'Förslag'],
  MySuggestions: ['My suggestions', 'Mina förslag'],
  PendingSuggestions: ['Pending suggestions', 'Väntande förslag'],
  SendSuggestion: ['Send suggestion', 'Skicka förslag'],
  SuggestionSent: [
    'Thanks! Your suggestion was sent to the admins',
    'Tack! Ditt förslag har skickats till administratörerna',
  ],
  SuggestionSaved: ['Suggestion saved', 'Förslaget sparades'],
  SuggestionDeleted: ['Suggestion deleted', 'Förslaget togs bort'],
  SuggestionApproved: ['Suggestion approved', 'Förslaget godkändes'],
  SuggestionRejected: ['Suggestion rejected', 'Förslaget avvisades'],
  NoSuggestions: ['There are no suggestions here', 'Det finns inga förslag här'],
  NewSongSuggestion: ['New song', 'Ny sång'],
  EditSuggestion: ['Edit of', 'Ändring av'],
  SuggestedBy: ['Suggested by', 'Föreslagen av'],
  Approve: ['Approve', 'Godkänn'],
  Reject: ['Reject', 'Avvisa'],
  Withdraw: ['Withdraw', 'Dra tillbaka'],
  WithdrawConfirm: [
    'Are you sure you want to withdraw this suggestion?',
    'Är du säker att du vill dra tillbaka förslaget?',
  ],
  ReviewComment: ['Comment (optional)', 'Kommentar (valfri)'],
  Current: ['Current', 'Nuvarande'],
  Suggested: ['Suggested', 'Föreslaget'],
  NoChanges: ['No changes', 'Inga ändringar'],
  Status_pending: ['Pending', 'Väntar'],
  Status_approved: ['Approved', 'Godkänd'],
  Status_rejected: ['Rejected', 'Avvisad'],
  SuggestionsHelp: [
    'Suggestions are reviewed by the admins before they end up in the songbook.',
    'Förslag granskas av administratörerna innan de hamnar i sångboken.',
  ],

  Language: ['Svenska', 'English'],
  GenericError: ['Something went wrong, try again', 'Någonting gick fel, försök igen'],
} as const satisfies Record<string, readonly [string, string]>

export type TranslationKey = keyof typeof translations
export type Texts = Record<TranslationKey, string>

const cache = new Map<Language, Texts>()

export function getTexts(language: Language): Texts {
  let texts = cache.get(language)
  if (!texts) {
    const index = language === 'sv' ? 1 : 0
    texts = Object.fromEntries(
      Object.entries(translations).map(([key, pair]) => [key, pair[index]]),
    ) as Texts
    cache.set(language, texts)
  }
  return texts
}

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'sv'
}

/** Translated message for an API error code, falls back to a generic message */
export function errorMessage(texts: Texts, code: string | undefined): string {
  if (code && code in texts) return texts[code as TranslationKey]
  return texts.GenericError
}

/** Display name of a tag in the active language, falling back to its name */
export function tagLabel(
  tag: { name: string; pretty_name_sv: string; pretty_name_en: string },
  language: Language,
): string {
  return (language === 'sv' ? tag.pretty_name_sv : tag.pretty_name_en) || tag.name
}

/** Same output on the server and in the browser, so it can be server rendered */
export function formatDate(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso))
}
