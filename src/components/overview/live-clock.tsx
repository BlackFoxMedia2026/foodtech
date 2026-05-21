"use client";

import { useEffect, useState } from "react";

function format(d: Date) {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function LiveClock({ initial }: { initial: string }) {
  const [time, setTime] = useState(initial);

  useEffect(() => {
    const tick = () => setTime(format(new Date()));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  return <>{time}</>;
}
