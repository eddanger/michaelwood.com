export default function uptimeCommand() {
  // Calculate uptime since November 22, 1977 (starting at midnight)
  const startDate = new Date("1977-11-22T00:00:00");
  const now = new Date();
  const diffMs = now - startDate; // difference in milliseconds

  // Convert milliseconds to seconds, minutes, hours, days.
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours   = Math.floor(totalMinutes / 60);
  const days         = Math.floor(totalHours / 24);
  const hours        = totalHours % 24;
  const minutes      = totalMinutes % 60;
  const seconds      = totalSeconds % 60;

  return `Uptime since November 22, 1977: ${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds.`;
}
