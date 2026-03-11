import React, { useState, useEffect } from 'react';

const COUNTDOWN_TARGET = new Date('2026-07-25T10:00:00+08:00').getTime();

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = new Date('2026-07-25T10:00:00+08:00');
      const diff = target - now;

      if (diff < 0) {
        return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      // Calculate months separately for a more natural feel
      let months = (target.getUTCFullYear() - now.getUTCFullYear()) * 12 + (target.getUTCMonth() - now.getUTCMonth());
      let targetDate = new Date(now);
      targetDate.setUTCMonth(targetDate.getUTCMonth() + months);
      
      if (targetDate > target) {
        months--;
        targetDate = new Date(now);
        targetDate.setUTCMonth(targetDate.getUTCMonth() + months);
      }

      const remainingDiff = target - targetDate;

      return {
        months: months,
        days: Math.floor(remainingDiff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((remainingDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((remainingDiff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((remainingDiff % (1000 * 60)) / 1000)
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="countdown">
      {Object.entries(timeLeft).map(([label, value]) => (
        <div className="countdown-item" key={label}>
          <span className="countdown-value">{value}</span>
          <span className="countdown-label">{label}</span>
        </div>
      ))}
    </div>
  );
};

export default Countdown;
