import { HEALTH_RESPONSE } from '../config/constants';

export interface HealthResponse {
  status: typeof HEALTH_RESPONSE.status;
}

export class HealthService {
  check(): HealthResponse {
    return { ...HEALTH_RESPONSE };
  }
}
