// Custom emojis defined in list.txt
export const KCS_EMOJIS = {
  // Navigation & Actions
  NEXT: { id: "1570378666595065906", name: "angleright" },
  PREV: { id: "1570378664867139584", name: "angleleft" },
  SETTINGS: { id: "1570378710010433636", name: "setting1" },
  ADD: { id: "1570378689508671548", name: "plus" },
  FILTER: { id: "1570378679102611507", name: "filter" },
  HELP: { id: "1570378685649780838", name: "interrongation" },
  EXCLAMATION: { id: "1570378733880221716", name: "exclamation" },
  SEARCH: { id: "1570378807540711424", name: "search" },
  CHECK: { id: "1570378674987999313", name: "check" },
  CANCEL: { id: "1570378676800069632", name: "cross" },
  DOWN: { id: "1570378673385898174", name: "caretdown" },
  SHARE: { id: "1570378714833756280", name: "share" },
  TRASH: { id: "1570378726175154276", name: "trash" },
  RELOAD: { id: "1570378691253506139", name: "rotateright" },

  // Logos
  SORA: { id: "1570750114534793227", name: "sora" },
  KCS: { id: "1570365125653823508", name: "kcs" },
} as const;

export const EMOJI_STRINGS = {
  NEXT: `<:${KCS_EMOJIS.NEXT.name}:${KCS_EMOJIS.NEXT.id}>`,
  PREV: `<:${KCS_EMOJIS.PREV.name}:${KCS_EMOJIS.PREV.id}>`,
  SETTINGS: `<:${KCS_EMOJIS.SETTINGS.name}:${KCS_EMOJIS.SETTINGS.id}>`,
  ADD: `<:${KCS_EMOJIS.ADD.name}:${KCS_EMOJIS.ADD.id}>`,
  FILTER: `<:${KCS_EMOJIS.FILTER.name}:${KCS_EMOJIS.FILTER.id}>`,
  HELP: `<:${KCS_EMOJIS.HELP.name}:${KCS_EMOJIS.HELP.id}>`,
  EXCLAMATION: `<:${KCS_EMOJIS.EXCLAMATION.name}:${KCS_EMOJIS.EXCLAMATION.id}>`,
  SEARCH: `<:${KCS_EMOJIS.SEARCH.name}:${KCS_EMOJIS.SEARCH.id}>`,
  CHECK: `<:${KCS_EMOJIS.CHECK.name}:${KCS_EMOJIS.CHECK.id}>`,
  CANCEL: `<:${KCS_EMOJIS.CANCEL.name}:${KCS_EMOJIS.CANCEL.id}>`,
  DOWN: `<:${KCS_EMOJIS.DOWN.name}:${KCS_EMOJIS.DOWN.id}>`,
  SHARE: `<:${KCS_EMOJIS.SHARE.name}:${KCS_EMOJIS.SHARE.id}>`,
  TRASH: `<:${KCS_EMOJIS.TRASH.name}:${KCS_EMOJIS.TRASH.id}>`,
  RELOAD: `<:${KCS_EMOJIS.RELOAD.name}:${KCS_EMOJIS.RELOAD.id}>`,
  SORA: `<:${KCS_EMOJIS.SORA.name}:${KCS_EMOJIS.SORA.id}>`,
  KCS: `<:${KCS_EMOJIS.KCS.name}:${KCS_EMOJIS.KCS.id}>`,
} as const;

export const DEVELOPER_ID = "1339604814631534667";
