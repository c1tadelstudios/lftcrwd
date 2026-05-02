import { NextRequest, NextResponse } from 'next/server';

// Linear project, team, and label IDs for lftcrwd Beta
const LINEAR_PROJECT_ID       = 'LINEAR_PROJECT_ID_REDACTED';
const LINEAR_TEAM_ID          = 'LINEAR_TEAM_ID_REDACTED';
const LINEAR_LABEL_COACH_REPORT = 'LINEAR_LABEL_ID_REDACTED';

const SEVERITY_PRIORITY: Record<string, number> = {
  blocking: 1, // Urgent
  high:     2, // High
  medium:   3, // Medium
  low:      4, // Low
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Linear API key not configured' }, { status: 500 });
  }

  const { description, area, severity } = await request.json();
  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description required' }, { status: 400 });
  }

  const priority = SEVERITY_PRIORITY[severity] ?? 3;
  const title    = `[Coach] ${(area ?? 'General').trim()}: ${description.trim().slice(0, 80)}`;
  const body     = [
    `**Reported by:** Coach (via in-app Report Issue)`,
    `**Area:** ${area ?? 'General'}`,
    `**Severity:** ${severity ?? 'medium'}`,
    ``,
    `**Description:**`,
    description.trim(),
  ].join('\n');

  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id url }
      }
    }
  `;

  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  apiKey,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          title,
          description: body,
          teamId:    LINEAR_TEAM_ID,
          projectId: LINEAR_PROJECT_ID,
          priority,
          labelIds: [LINEAR_LABEL_COACH_REPORT],
        },
      },
    }),
  });

  const json = await res.json();
  if (!json?.data?.issueCreate?.success) {
    return NextResponse.json({ error: 'Failed to create Linear issue' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: json.data.issueCreate.issue.url });
}
