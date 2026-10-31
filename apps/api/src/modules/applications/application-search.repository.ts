import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { HEADLINE_MARKS, type SearchMatch } from './application-search.js';

export type SearchQuery = { q: string };

export type SnippetQuery = SearchQuery & { applicationIds: readonly string[] };

export type SearchHeadline = { id: string; headline: string };

const HEADLINE_OPTIONS =
  `MaxFragments=1, MaxWords=16, MinWords=6, StartSel=${HEADLINE_MARKS.start}, StopSel=${HEADLINE_MARKS.stop}` as const;

@Injectable()
export class ApplicationSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMatches(userId: string, { q }: SearchQuery): Promise<SearchMatch[]> {
    return this.prisma.$queryRaw<SearchMatch[]>`
      SELECT a.id, (ts_rank(a.search_vector, s.query) + coalesce(n.rank, 0))::float8 AS rank
      FROM applications a
      CROSS JOIN jobflow_search_query(${q}::text) AS s(query)
      LEFT JOIN LATERAL (
        SELECT max(ts_rank(n.search_vector, s.query)) AS rank
        FROM notes n
        WHERE n.application_id = a.id AND n.search_vector @@ s.query
      ) n ON true
      WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
        AND (a.search_vector @@ s.query OR n.rank IS NOT NULL)
      ORDER BY rank DESC, a.id DESC`;
  }

  findSnippets(userId: string, { q, applicationIds }: SnippetQuery): Promise<SearchHeadline[]> {
    return this.prisma.$queryRaw<SearchHeadline[]>`
      SELECT a.id, ts_headline('jobflow_search', concat_ws(' … ',
          array_to_string(a.stack, ', '),
          a.raw_text,
          (SELECT string_agg(n.body, ' … ' ORDER BY n.created_at DESC, n.id DESC)
            FROM notes n
            WHERE n.application_id = a.id AND n.search_vector @@ s.query)
        ), s.query, ${HEADLINE_OPTIONS}::text) AS headline
      FROM applications a
      CROSS JOIN jobflow_search_query(${q}::text) AS s(query)
      WHERE a.id = ANY(${[...applicationIds]}::uuid[]) AND a.user_id = ${userId}::uuid`;
  }
}
