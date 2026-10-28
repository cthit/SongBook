// Shared between server and client code, keep free of server-only imports

export interface Song {
  song_id: string
  title: string
  number: number
  melody: string
  author: string
  text: string
  tags: string[]
  hidden: boolean
}

export interface Tag {
  tag_id: string
  name: string
  pretty_name_sv: string
  pretty_name_en: string
  /** Ids of the (visible) songs with this tag, same as the old API */
  song: string[]
}

export interface SongInput {
  title: string
  author: string
  melody: string
  text: string
  tags: string[]
  hidden?: boolean
}

export interface TagInput {
  name: string
  pretty_name_sv: string
  pretty_name_en: string
}

export type SuggestionKind = 'new' | 'edit'
export type SuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface Suggestion {
  id: string
  kind: SuggestionKind
  song_id: string | null
  title: string
  author: string
  melody: string
  text: string
  tags: string[]
  suggested_by_sub: string
  suggested_by_cid: string
  suggested_by_name: string
  status: SuggestionStatus
  created_at: string
  reviewed_at: string | null
  reviewed_by_cid: string | null
  review_comment: string | null
}

/** What the browser gets to know about the signed in user */
export interface PublicUser {
  cid: string
  nickname: string
  name: string
  locale: string
  picture: string | null
  isAdmin: boolean
}
