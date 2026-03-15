require('dotenv/config');
const axios = require('axios');

const COURSE_BY_SCHEDULE = {
  '11078': '22528', // Francis Byrne
  '11077': '22527', // Weequahic
  '11075': '22526', // Hendricks Field
};

const DEFAULT_COURSE_ID = '22528';
const PREFERRED_BOOKING_CLASS_ID = '49772';

function toForeUpDate(date) {
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[2]}-${m[3]}-${m[1]}`;
  return String(date);
}

function getArg(name, fallback) {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!arg) return fallback;
  return arg.split('=').slice(1).join('=');
}

async function run() {
  const scheduleId = getArg('scheduleId', '11078');
  const date = getArg('date', new Date().toISOString().split('T')[0]);
  const players = parseInt(getArg('players', '1'), 10);
  const apiPlayers = parseInt(getArg('apiPlayers', '0'), 10);
  const foreUpDate = toForeUpDate(date);
  const courseId = COURSE_BY_SCHEDULE[scheduleId] || DEFAULT_COURSE_ID;

  const username = process.env.FRANCIS_BYRNE_USERNAME || '';
  const password = process.env.FRANCIS_BYRNE_PASSWORD || '';
  if (!username || !password) {
    console.error('Missing FRANCIS_BYRNE_USERNAME or FRANCIS_BYRNE_PASSWORD in environment');
    process.exit(1);
  }

  const client = axios.create({
    baseURL: 'https://foreupsoftware.com',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Api-Key': 'no_limits',
      'X-Fu-Golfer-Location': 'foreup',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  const loginData = new URLSearchParams({
    username,
    password,
    booking_class_id: '',
    api_key: 'no_limits',
    course_id: courseId,
  });

  let jwt = '';
  let bookingClassId = PREFERRED_BOOKING_CLASS_ID;
  let cookies = '';

  try {
    const loginRes = await client.post('/index.php/api/booking/users/login', loginData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://foreupsoftware.com',
        'Referer': `https://foreupsoftware.com/index.php/booking/${courseId}/${scheduleId}`,
      },
    });
    jwt = loginRes.data.jwt;
    const loginBookingClassId = String(loginRes.data.booking_class_ids?.[0] || 49772);
    const setCookie = loginRes.headers['set-cookie'];
    if (Array.isArray(setCookie) && setCookie.length > 0) {
      cookies = setCookie.map((c) => c.split(';')[0]).join('; ');
    }
    console.log('Login OK', JSON.stringify({
      scheduleId,
      courseId,
      date,
      foreUpDate,
      players,
      apiPlayers,
      loginBookingClassId,
      bookingClassIdUsed: bookingClassId,
      hasJwt: Boolean(jwt),
      cookieCount: Array.isArray(setCookie) ? setCookie.length : 0,
    }));
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Login failed', JSON.stringify({ scheduleId, courseId, status, data }));
    process.exit(1);
  }

  const params = new URLSearchParams({
    time: 'all',
    date: foreUpDate,
    holes: 'all',
    players: String(apiPlayers),
    booking_class: bookingClassId,
    schedule_id: scheduleId,
    specials_only: '0',
    api_key: 'no_limits',
  });
  for (const sid of Object.keys(COURSE_BY_SCHEDULE)) {
    params.append('schedule_ids[]', sid);
  }
  const requestPath = `/index.php/api/booking/times?${params.toString()}`;

  try {
    const timesRes = await client.get(requestPath, {
      headers: {
        'X-Authorization': `Bearer ${jwt}`,
        'Cookie': cookies,
      },
    });
    const data = Array.isArray(timesRes.data) ? timesRes.data : [];
    console.log('Times request', requestPath);
    console.log('Times response', JSON.stringify({
      httpStatus: timesRes.status,
      rawCount: data.length,
      sample: data.slice(0, 10),
    }, null, 2));
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error('Times query failed', JSON.stringify({ requestPath, status, data }, null, 2));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unexpected error', err);
  process.exit(1);
});
