import { io } from 'socket.io-client';

const env = process.env;
const ACK_TIMEOUT_MS = 15_000;
const RUN_TIMEOUT_MS = 120_000;
const NOTIFICATION_NAME = 'JobFlow Telegram';
const STATUS_PAGE_SLUG = 'jobflow';
const STATUS_PAGE_TITLE = 'JobFlow status';
const STATUS_PAGE_GROUP = 'Сервіси';
const STATUS_PAGE_ICON = '/icon.svg';
const CHECK_TIMING = { interval: 60, retryInterval: 30, maxretries: 1 };
const PUSH_TIMING = { interval: 90, retryInterval: 90, maxretries: 0 };

const HTTP_TARGETS = [
  ['web', 'http://web:3000/login'],
  ['api', 'http://api:4000/api/v1/ready'],
  ['analytics', 'http://analytics:8000/health'],
  ['ai', 'http://ai:8001/health'],
  ['documents', 'http://documents:8002/health'],
  ['minio', 'http://minio:9000/minio/health/live'],
];

const PORT_TARGETS = [
  ['postgres', 5432],
  ['redis', 6379],
];

const STATUS_PAGE_CONFIG = {
  slug: STATUS_PAGE_SLUG,
  title: STATUS_PAGE_TITLE,
  description: null,
  logo: STATUS_PAGE_ICON,
  autoRefreshInterval: 60,
  theme: 'auto',
  showTags: false,
  footerText: null,
  customCSS: '',
  showPoweredBy: false,
  showCertificateExpiry: false,
  showOnlyLastHeartbeat: false,
  rssTitle: null,
  domainNameList: [],
  analyticsId: null,
  analyticsScriptUrl: null,
  analyticsType: null,
};

function monitorDefinitions() {
  return [
    ...HTTP_TARGETS.map(([name, url]) => ({
      ...CHECK_TIMING,
      name,
      type: 'http',
      url,
      method: 'GET',
    })),
    ...PORT_TARGETS.map(([name, port]) => ({
      ...CHECK_TIMING,
      name,
      type: 'port',
      hostname: name,
      port,
    })),
    { ...PUSH_TIMING, name: 'worker', type: 'push', pushToken: env.UPTIME_KUMA_PUSH_TOKEN },
  ];
}

function ask(socket, [event, ...args]) {
  return socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, ...args);
}

async function request(socket, call) {
  const reply = await ask(socket, call);
  if (reply?.ok === false) {
    throw new Error(`${call[0]} failed: ${String(reply.msg)}`);
  }
  return reply;
}

function connect(url) {
  const socket = io(url, { transports: ['websocket'], reconnection: false });
  return new Promise((resolve, reject) => {
    socket.once('info', () => {
      resolve(socket);
    });
    socket.once('connect_error', reject);
  });
}

function nextEvent(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

async function signIn(socket) {
  const username = env.UPTIME_KUMA_ADMIN_USER;
  const password = env.UPTIME_KUMA_ADMIN_PASSWORD;
  if (await ask(socket, ['needSetup'])) {
    await request(socket, ['setup', username, password]);
  }
  await request(socket, ['login', { username, password, token: '' }]);
}

async function ensureNotification(socket, notifications) {
  const existingId = notifications.find(({ name }) => name === NOTIFICATION_NAME)?.id ?? null;
  const telegramBotToken = env.UPTIME_KUMA_TELEGRAM_BOT_TOKEN;
  const telegramChatID = env.UPTIME_KUMA_TELEGRAM_CHAT_ID;
  if (!telegramBotToken || !telegramChatID) {
    return existingId;
  }
  const notification = {
    name: NOTIFICATION_NAME,
    type: 'telegram',
    telegramBotToken,
    telegramChatID,
    telegramServerUrl: env.UPTIME_KUMA_TELEGRAM_SERVER_URL,
    isDefault: true,
    applyExisting: true,
    active: true,
  };
  const reply = await request(socket, ['addNotification', notification, existingId]);
  return reply.id;
}

async function ensureMonitors(socket, { monitorList, notificationId }) {
  const existing = new Map(Object.values(monitorList).map(({ name, id }) => [name, id]));
  const notificationIDList = notificationId === null ? {} : { [notificationId]: true };
  const ids = [];
  for (const definition of monitorDefinitions()) {
    const monitor = {
      ...definition,
      accepted_statuscodes: ['200-299'],
      conditions: [],
      notificationIDList,
    };
    const id = existing.get(monitor.name) ?? (await request(socket, ['add', monitor])).monitorID;
    ids.push(id);
  }
  return ids;
}

async function ensureStatusPage(socket, monitorIds) {
  const page = await ask(socket, ['getStatusPage', STATUS_PAGE_SLUG]);
  if (!page.ok) {
    await request(socket, ['addStatusPage', STATUS_PAGE_TITLE, STATUS_PAGE_SLUG]);
  }
  const group = { name: STATUS_PAGE_GROUP, monitorList: monitorIds.map((id) => ({ id })) };
  await request(socket, [
    'saveStatusPage',
    STATUS_PAGE_SLUG,
    STATUS_PAGE_CONFIG,
    STATUS_PAGE_ICON,
    [group],
  ]);
}

async function bootstrap() {
  const socket = await connect(env.UPTIME_KUMA_URL);
  const lists = Promise.all([
    nextEvent(socket, 'monitorList'),
    nextEvent(socket, 'notificationList'),
  ]);
  await signIn(socket);
  const [monitorList, notifications] = await lists;
  const notificationId = await ensureNotification(socket, notifications);
  const monitorIds = await ensureMonitors(socket, { monitorList, notificationId });
  await ensureStatusPage(socket, monitorIds);
  socket.disconnect();
  process.stdout.write(
    [
      `Monitors: ${String(monitorIds.length)}, Telegram alerts: ${notificationId === null ? 'off' : 'on'}`,
      `Status page: http://localhost:3002/status/${STATUS_PAGE_SLUG}`,
      `UPTIME_KUMA_PUSH_URL=http://localhost:3002/api/push/${String(env.UPTIME_KUMA_PUSH_TOKEN)}`,
      '',
    ].join('\n'),
  );
}

function fail(error) {
  process.stderr.write(
    `uptime-kuma-bootstrap: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

setTimeout(() => {
  fail(new Error('timed out'));
}, RUN_TIMEOUT_MS).unref();

bootstrap().catch(fail);
