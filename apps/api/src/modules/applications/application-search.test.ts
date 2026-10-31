import { describe, expect, it } from 'vitest';

import { rankedPage, type SearchMatch, snippetPartsOf } from './application-search.js';

const ID_A = '0199f1b0-4c5d-7e6f-8a7b-9c0d1e2f3a41';
const ID_B = '0199f1b0-4c5d-7e6f-8a7b-9c0d1e2f3a42';
const ID_C = '0199f1b0-4c5d-7e6f-8a7b-9c0d1e2f3a43';
const ID_D = '0199f1b0-4c5d-7e6f-8a7b-9c0d1e2f3a44';

const MATCHES: SearchMatch[] = [
  { id: ID_D, rank: 0.9 },
  { id: ID_C, rank: 0.5 },
  { id: ID_B, rank: 0.5 },
  { id: ID_A, rank: 0.1 },
];

const ALL_IDS = [ID_A, ID_B, ID_C, ID_D];

describe('the search snippet', () => {
  it.each([
    { case: 'a headline without marks', headline: 'Kafka, Go … Шукаємо бекенд' },
    { case: 'an empty headline', headline: '' },
  ])('is null for $case', ({ headline }) => {
    expect(snippetPartsOf(headline)).toBeNull();
  });

  it.each([
    {
      case: 'two marked words inside the text',
      headline: 'Стек: Kafka, Go і Kafka Streams',
      parts: [
        { text: 'Стек: ', match: false },
        { text: 'Kafka', match: true },
        { text: ', Go і ', match: false },
        { text: 'Kafka', match: true },
        { text: ' Streams', match: false },
      ],
    },
    {
      case: 'a mark at the start and at the end',
      headline: 'Zürich офіс, Go kafka',
      parts: [
        { text: 'Zürich', match: true },
        { text: ' офіс, Go ', match: false },
        { text: 'kafka', match: true },
      ],
    },
  ])('splits $case into plain and matched parts', ({ headline, parts }) => {
    expect(snippetPartsOf(headline)).toEqual(parts);
  });
});

describe('the relevance page', () => {
  it.each([
    { case: 'the first rows in rank order', allowedIds: ALL_IDS, take: 2, ids: [ID_D, ID_C] },
    {
      case: 'the rows the other filters allow',
      allowedIds: [ID_A, ID_B, ID_D],
      take: 3,
      ids: [ID_D, ID_B, ID_A],
    },
    {
      case: 'the rows strictly after a cursor on a tie of equal ranks',
      allowedIds: ALL_IDS,
      cursor: { id: ID_C, rank: 0.5 },
      take: 5,
      ids: [ID_B, ID_A],
    },
    {
      case: 'the rows after a cursor on a higher rank',
      allowedIds: ALL_IDS,
      cursor: { id: ID_D, rank: 0.9 },
      take: 1,
      ids: [ID_C],
    },
  ])('takes $case', ({ allowedIds, cursor, take, ids }) => {
    const page = rankedPage({ matches: MATCHES, allowedIds, cursor, take });

    expect(page.map(({ id }) => id)).toEqual(ids);
  });
});
