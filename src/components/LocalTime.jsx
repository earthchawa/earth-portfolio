import { useEffect, useState } from 'react';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export default function LocalTime() {
  const [now, setNow] = useState(() => fmt.format(new Date()));

  useEffect(() => {
    const id = setInterval(() => setNow(fmt.format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums">{now}</span>;
}