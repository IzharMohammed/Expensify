export type ChatToolName =
  | 'get_category_total'
  | 'compare_months'
  | 'get_top_merchants'
  | 'get_top_categories'
  | 'project_savings';

export type PlannerMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: ChatToolName;
      arguments: string;
    };
  }>;
};

export type PlannedToolCall = {
  id: string;
  name: ChatToolName;
  arguments: Record<string, unknown>;
};
