import { describe, expect, it } from 'vitest';

import { pageTextOf } from './extract.js';
import { DJINNI_PAGE, DOU_PAGE, LINKEDIN_PAGE } from './test/fixtures/pages.js';
import { mountPage, selectText } from './test/page.js';

const DOU_TEXT = [
  'Acme Software',
  'Senior React Developer',
  'віддалено $4000–5000',
  'Шукаємо React розробника в продуктову команду.',
  'TypeScript',
  'Next.js',
].join('\n');

const DJINNI_TEXT = [
  'Middle Python Engineer',
  'Будуємо платформу аналітики для рітейлу.',
  'Django, PostgreSQL, Celery.',
  'Тільки віддалено',
  '3 роки досвіду',
].join('\n');

const LINKEDIN_TEXT = [
  'Frontend Engineer',
  'Globex',
  'Build the design system.',
  'React, TypeScript.',
].join('\n');

describe('pageTextOf', () => {
  it.each([
    { name: 'the DOU vacancy block with its company', page: DOU_PAGE, text: DOU_TEXT },
    { name: 'the Djinni job post', page: DJINNI_PAGE, text: DJINNI_TEXT },
    { name: 'the main of a LinkedIn-like job page', page: LINKEDIN_PAGE, text: LINKEDIN_TEXT },
  ])('reads $name line by line, without nav and footer', ({ page, text }) => {
    mountPage(page);

    expect(pageTextOf(document)).toBe(text);
  });

  it('takes what the user selected over the vacancy block', () => {
    mountPage(DOU_PAGE);
    selectText('.salary');

    expect(pageTextOf(document)).toBe('$4000–5000');
  });

  it('reads the DOU vacancy column when the outer block is missing', () => {
    mountPage({
      html: '<div class="b-similar">Схожі вакансії</div><div class="l-vacancy"><h1>QA Engineer</h1><p>Playwright</p></div>',
    });

    expect(pageTextOf(document)).toBe('QA Engineer\nPlaywright');
  });

  it('prefers an article to the main around it', () => {
    mountPage({ html: '<main><p>Стрічка</p><article><p>Опис вакансії</p></article></main>' });

    expect(pageTextOf(document)).toBe('Опис вакансії');
  });

  it.each([
    ['an empty', '<article></article>'],
    ['a hidden', '<article hidden><p>Прихований анонс</p></article>'],
  ])('passes over %s article and reads the main', (_name, article) => {
    mountPage({ html: `${article}<main><p>Опис вакансії</p></main>` });

    expect(pageTextOf(document)).toBe('Опис вакансії');
  });

  it('keeps the text that lies in the body beside nav and footer', () => {
    mountPage({ html: '<nav>Меню</nav>Опис вакансії<footer>Юридична інформація</footer>' });

    expect(pageTextOf(document)).toBe('Опис вакансії');
  });

  it('walks the body and leaves nav and footer out, however deep', () => {
    mountPage({
      html: `
        <nav>Меню</nav>
        <div><p>Перший рядок</p><p>Другий рядок</p></div>
        <div><nav>Хлібні крихти</nav><section>Вкладений текст</section></div>
        <footer>Юридична інформація</footer>`,
    });

    expect(pageTextOf(document)).toBe('Перший рядок\nДругий рядок\nВкладений текст');
  });

  it('walks the body and leaves script, style and noscript source out', () => {
    mountPage({
      html: `
        <nav>Меню</nav>
        <div><p>Опис вакансії</p></div>
        <script type="application/ld+json">{"@type":"JobPosting"}</script>
        <script>window.dataLayer=[]</script>
        <style>.promo{color:red}</style>
        <noscript><p>Увімкніть JavaScript</p></noscript>
        <div><footer>Юридична інформація</footer><style>.legal{margin:0}</style></div>`,
    });

    expect(pageTextOf(document)).toBe('Опис вакансії');
  });

  it('walks the body and leaves out what the page does not render', () => {
    mountPage({
      html: `
        <style>.collapsed{display:none}</style>
        <nav>Меню</nav>
        <div><p>Опис вакансії</p></div>
        <div hidden>Прихований лічильник</div>
        <div class="collapsed">Згорнутий блок</div>`,
    });

    expect(pageTextOf(document)).toBe('Опис вакансії');
  });
});
