export interface Proposal {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'review' | 'published';
  original_html: string;
  stylesheet: string | null;
  scripts: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContentBlock {
  id: string;
  proposal_id: string;
  block_order: number;
  visible: boolean;
  label: string | null;
  original_html: string;
  current_html: string;
  wrapper_class: string | null;
  updated_at: string;
}

export interface Comment {
  id: string;
  proposal_id: string;
  block_id: string | null;
  author_id: string;
  author_name: string;
  text: string;
  resolved: boolean;
  created_at: string;
}

export interface ParseResult {
  title: string;
  stylesheet: string;
  scripts: string;
  blocks: ParsedBlock[];
}

export interface ParsedBlock {
  order: number;
  label: string;
  html: string;
  wrapperClass?: string;
}
