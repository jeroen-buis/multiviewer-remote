export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

export function setCookie(name: string, value: string, days: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  const cookieValue = encodeURIComponent(value || "");
  let cookieString = `${name}=${cookieValue}${expires}; path=/; SameSite=Lax`;

  // Only add the Secure attribute if the page is served over HTTPS
  if (window.location.protocol === 'https:') {
    cookieString += "; Secure";
  }

  document.cookie = cookieString;
}

type Units = 'metric' | 'imperial';

export const convertTemp = (celsius: number, units: Units): number =>
  units === 'imperial' ? celsius * 9 / 5 + 32 : celsius;

export const convertWindSpeed = (kmh: number, units: Units): number =>
  units === 'imperial' ? kmh * 0.621371 : kmh;

export const tempUnit = (units: Units): string =>
  units === 'imperial' ? '°F' : '°C';

export const windUnit = (units: Units): string =>
  units === 'imperial' ? 'mph' : 'km/h';

export const lapTimeToSeconds = (time: string): number | null => {
    if (!time || typeof time !== 'string') return null;
    try {
        const parts = time.split(':');
        let minutes, seconds;
        if (parts.length === 2) {
            minutes = parseInt(parts[0], 10);
            seconds = parseFloat(parts[1]);
        } else if (parts.length === 1) {
            minutes = 0;
            seconds = parseFloat(parts[0]);
        } else {
            return null; // Invalid format
        }

        if (isNaN(minutes) || isNaN(seconds)) return null;
        return minutes * 60 + seconds;
    } catch {
        return null;
    }
};