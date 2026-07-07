export type ItemStatus = 'pending' | 'approved' | 'rejected';

export interface AdminItem {
  id: number;
  label: string | null;
  status: ItemStatus;
  image_key: string | null;
  votes_left: number;
  votes_right: number;
  report_count: number;
  created_at: number;
}

export interface AdminReport {
  id: number;
  item_id: number;
  label: string | null;
  reason: string | null;
  status: ItemStatus;
  report_count: number;
  created_at: number;
}

export interface Category {
  key: string;
  name: string;
}

export interface Stats {
  items: number;
  votesLeft: number;
  votesRight: number;
}
