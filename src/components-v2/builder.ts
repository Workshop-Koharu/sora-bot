import { ButtonStyle, ComponentType } from "discord.js";
import { KCS_EMOJIS } from "../constants/emojis.js";

export const IS_COMPONENTS_V2_FLAG = 32768; // 1 << 15
export const EPHEMERAL_FLAG = 64; // 1 << 6
export const V2_EPHEMERAL_FLAGS = IS_COMPONENTS_V2_FLAG | EPHEMERAL_FLAG; // 32832

export enum V2ComponentType {
  ActionRow = 1,
  Button = 2,
  StringSelect = 3,
  UserSelect = 5,
  RoleSelect = 6,
  MentionableSelect = 7,
  ChannelSelect = 8,
  Section = 9,
  TextDisplay = 10,
  Thumbnail = 11,
  MediaGallery = 12,
  File = 13,
  Separator = 14,
  Container = 17,
}

export interface V2TextDisplay {
  type: V2ComponentType.TextDisplay;
  content: string;
}

export interface V2Thumbnail {
  type: V2ComponentType.Thumbnail;
  media: {
    url: string;
    description?: string;
  };
}

export interface V2MediaGalleryItem {
  media: {
    url: string;
    description?: string;
  };
}

export interface V2MediaGallery {
  type: V2ComponentType.MediaGallery;
  items: V2MediaGalleryItem[];
}

export interface V2Separator {
  type: V2ComponentType.Separator;
  divider?: boolean;
  spacing?: 1 | 2; // 1 = small, 2 = large
}

export interface V2Button {
  type: V2ComponentType.Button;
  style: ButtonStyle;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  label?: string;
  emoji?: {
    id: string;
    name: string;
  };
}

export interface V2SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { id?: string; name: string };
  default?: boolean;
}

export interface V2SelectMenu {
  type:
    | V2ComponentType.StringSelect
    | V2ComponentType.UserSelect
    | V2ComponentType.RoleSelect
    | V2ComponentType.MentionableSelect
    | V2ComponentType.ChannelSelect;
  custom_id: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
  options?: V2SelectOption[];
  channel_types?: number[];
}

export interface V2ActionRow {
  type: V2ComponentType.ActionRow;
  components: (V2Button | V2SelectMenu)[];
}

export interface V2Section {
  type: V2ComponentType.Section;
  components: V2TextDisplay[];
  accessory?: V2Thumbnail | V2Button;
}

export type V2ChildComponent =
  | V2TextDisplay
  | V2Section
  | V2Thumbnail
  | V2MediaGallery
  | V2Separator
  | V2ActionRow;

export interface V2Container {
  type: V2ComponentType.Container;
  accent_color?: number;
  components: V2ChildComponent[];
}

export class ComponentsV2Builder {
  /**
   * Creates a text display component (Markdown supported)
   */
  static text(content: string): V2TextDisplay {
    return {
      type: V2ComponentType.TextDisplay,
      content,
    };
  }

  /**
   * Creates a divider or vertical spacer
   */
  static separator(divider = true, spacing: 1 | 2 = 1): V2Separator {
    return {
      type: V2ComponentType.Separator,
      divider,
      spacing,
    };
  }

  /**
   * Creates a section with accessory (e.g. thumbnail on right side)
   */
  static section(
    content: string,
    accessory?: { url: string; description?: string } | V2Button
  ): V2Section {
    let acc: V2Thumbnail | V2Button | undefined;
    if (accessory) {
      if ("url" in accessory && typeof (accessory as any).url === "string" && !("type" in accessory)) {
        const thumb = accessory as { url: string; description?: string };
        acc = {
          type: V2ComponentType.Thumbnail,
          media: { url: thumb.url, description: thumb.description },
        };
      } else {
        acc = accessory as V2Button;
      }
    }
    return {
      type: V2ComponentType.Section,
      components: [{ type: V2ComponentType.TextDisplay, content }],
      accessory: acc,
    };
  }

  /**
   * Creates a media gallery (up to 10 images)
   */
  static mediaGallery(urls: Array<{ url: string; description?: string }>): V2MediaGallery {
    return {
      type: V2ComponentType.MediaGallery,
      items: urls.map((u) => ({
        media: { url: u.url, description: u.description },
      })),
    };
  }

  /**
   * Creates an ActionRow wrapper
   */
  static actionRow(...components: (V2Button | V2SelectMenu)[]): V2ActionRow {
    return {
      type: V2ComponentType.ActionRow,
      components,
    };
  }

  /**
   * Creates a custom emoji button complying strictly with list.txt rules:
   * - No label text
   * - Custom emoji only
   * - Secondary style (gray) to contrast against black custom emojis (avoiding black/dark backgrounds)
   */
  static emojiButton(
    emojiKey: keyof typeof KCS_EMOJIS,
    customId: string,
    options?: {
      disabled?: boolean;
      style?: ButtonStyle;
    }
  ): V2Button {
    const emoji = KCS_EMOJIS[emojiKey];
    return {
      type: V2ComponentType.Button,
      custom_id: customId,
      style: options?.style ?? ButtonStyle.Secondary,
      disabled: options?.disabled ?? false,
      emoji: {
        id: emoji.id,
        name: emoji.name,
      },
    };
  }

  /**
   * Standard button with label (if explicitly allowed or needed outside custom emoji buttons)
   */
  static button(
    label: string,
    customId: string,
    style: ButtonStyle = ButtonStyle.Secondary,
    options?: { disabled?: boolean; emoji?: { id?: string; name: string } }
  ): V2Button {
    return {
      type: V2ComponentType.Button,
      custom_id: customId,
      style,
      label,
      disabled: options?.disabled,
      emoji: options?.emoji?.id
        ? { id: options.emoji.id, name: options.emoji.name }
        : undefined,
    };
  }

  /**
   * Link button
   */
  static linkButton(
    label: string,
    url: string,
    options?: { emoji?: { id?: string; name: string }; disabled?: boolean }
  ): V2Button {
    return {
      type: V2ComponentType.Button,
      url,
      style: ButtonStyle.Link,
      label,
      disabled: options?.disabled,
      emoji: options?.emoji?.id
        ? { id: options.emoji.id, name: options.emoji.name }
        : undefined,
    };
  }

  /**
   * Creates a String Select Menu
   */
  static stringSelect(
    customId: string,
    options: V2SelectOption[],
    placeholder?: string,
    minValues = 1,
    maxValues = 1
  ): V2SelectMenu {
    return {
      type: V2ComponentType.StringSelect,
      custom_id: customId,
      placeholder,
      min_values: minValues,
      max_values: maxValues,
      options,
    };
  }

  /**
   * Creates a Role Select Menu
   */
  static roleSelect(
    customId: string,
    placeholder?: string,
    minValues = 1,
    maxValues = 1
  ): V2SelectMenu {
    return {
      type: V2ComponentType.RoleSelect,
      custom_id: customId,
      placeholder,
      min_values: minValues,
      max_values: maxValues,
    };
  }

  /**
   * Creates a Channel Select Menu
   */
  static channelSelect(
    customId: string,
    placeholder?: string,
    channelTypes?: number[],
    minValues = 1,
    maxValues = 1
  ): V2SelectMenu {
    return {
      type: V2ComponentType.ChannelSelect,
      custom_id: customId,
      placeholder,
      channel_types: channelTypes,
      min_values: minValues,
      max_values: maxValues,
    };
  }

  /**
   * Root Container component (Type 17)
   */
  static container(
    children: V2ChildComponent[],
    accentColor: number = 0x5865f2
  ): V2Container {
    return {
      type: V2ComponentType.Container,
      accent_color: accentColor,
      components: children,
    };
  }

  /**
   * Helper to format a message payload with Components V2 flags
   */
  static formatMessage(
    container: V2Container,
    isEphemeral = false
  ) {
    return {
      flags: isEphemeral ? V2_EPHEMERAL_FLAGS : IS_COMPONENTS_V2_FLAG,
      components: [container] as any,
    };
  }
}
