import helmet from 'helmet';

export const devToolHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      fontSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: null,
    },
  },
});
