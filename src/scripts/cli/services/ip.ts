import { serviceUrls } from '../config';

export interface IpWhoResponse {
  success?: boolean;
  ip?: string;
  type?: string;
  continent?: string;
  country?: string;
  country_code?: string;
  city?: string;
  timezone?: {
    id?: string;
    utc?: string;
  };
  message?: string;
}

let cachedResponse: IpWhoResponse | null = null;
let pendingRequest: Promise<IpWhoResponse> | null = null;

export async function getPublicIpInfo() {
  if (cachedResponse) return cachedResponse;
  if (!pendingRequest) {
    pendingRequest = fetch(serviceUrls.ipLookup).then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as IpWhoResponse;
      if (data.success === false || !data.ip) throw new Error(data.message ?? 'invalid response');
      cachedResponse = data;
      return data;
    });
  }
  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}
