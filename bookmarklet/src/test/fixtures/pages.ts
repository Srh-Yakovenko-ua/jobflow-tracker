import type { PageFixture } from '../page.js';

export const DOU_PAGE = {
  path: '/companies/acme/vacancies/271828/',
  title: 'Senior React Developer в Acme Software | DOU',
  html: `
    <header class="b-head"><nav class="b-nav">Форум Стрічка Робота</nav></header>
    <div class="g-page">
      <div class="b-vacancy">
        <div class="b-compinfo"><div class="info"><div class="l-n"><a href="/companies/acme/">Acme Software</a></div></div></div>
        <div class="l-vacancy">
          <h1 class="g-h2">Senior React Developer</h1>
          <div class="sh-info"><span class="place">віддалено</span> <span class="salary">$4000–5000</span></div>
          <div class="b-typo vacancy-section"><p>Шукаємо React розробника в продуктову команду.</p><ul><li>TypeScript</li><li>Next.js</li></ul></div>
        </div>
      </div>
      <div class="b-similar"><div class="title">Схожі вакансії</div></div>
    </div>
    <footer class="b-footer">© 2005–2026 DOU</footer>`,
} satisfies PageFixture;

export const DJINNI_PAGE = {
  path: '/jobs/718293-middle-python-engineer/',
  title: 'Middle Python Engineer at Initech | Djinni',
  html: `
    <nav class="navbar">Вакансії Зарплати</nav>
    <div class="container job-post-page">
      <h1>Middle Python Engineer</h1>
      <div class="job-post__description"><p>Будуємо платформу аналітики для рітейлу.</p><p>Django, PostgreSQL, Celery.</p></div>
      <aside class="job-post__details"><ul><li>Тільки віддалено</li><li>3 роки досвіду</li></ul></aside>
    </div>
    <footer class="footer">Djinni © 2026</footer>`,
} satisfies PageFixture;

export const LINKEDIN_PAGE = {
  path: '/jobs/view/4321',
  title: 'Frontend Engineer at Globex',
  html: `
    <header class="global-nav"><nav class="nav">Jobs People Learning</nav></header>
    <main class="main" id="main-content">
      <section class="top-card-layout"><h1 class="top-card-layout__title">Frontend Engineer</h1><span class="topcard__org-name-link">Globex</span></section>
      <div class="description__text"><div class="show-more-less-html__markup"><p>Build the design system.</p><p>React, TypeScript.</p></div></div>
    </main>
    <footer class="li-footer">LinkedIn © 2026</footer>`,
} satisfies PageFixture;
