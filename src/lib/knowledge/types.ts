export type KnowledgeCatalogEntry = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  tags: readonly string[];
  value?: number;
  stats?: readonly { label: string; value: number | null }[];
  attachments?: readonly string[];
  sourceUrl?: string;
  verifiedAt?: string;
  character?: {
    age: number | null;
    birthday: string;
    gender: string;
    biography: string;
    abilityName: string;
    abilityDescription: string;
    awakened: boolean;
    baseAbility?: { name: string; description: string; sourceUrl: string };
    parameters: readonly { label: string; value: string }[];
  };
};
