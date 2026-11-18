import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';

@Injectable()
export class AuthClock extends Clock {}
