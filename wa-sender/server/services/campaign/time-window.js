/**
 * Helper service to manage campaign time windows
 */

/**
 * Check if the current time is within the campaign's time window
 * @param {string} timeWindowStart - Start time in HH:MM format
 * @param {string} timeWindowEnd - End time in HH:MM format
 * @returns {boolean} - True if current time is within window, false otherwise
 */
function isWithinTimeWindow(timeWindowStart, timeWindowEnd) {
  if (!timeWindowStart || !timeWindowEnd) return true;
  
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  
  const [startHours, startMinutes] = timeWindowStart.split(':').map(Number);
  const [endHours, endMinutes] = timeWindowEnd.split(':').map(Number);
  
  const currentTimeValue = currentHours * 60 + currentMinutes;
  const startTimeValue = startHours * 60 + startMinutes;
  const endTimeValue = endHours * 60 + endMinutes;
  
  return currentTimeValue >= startTimeValue && currentTimeValue <= endTimeValue;
}

/**
 * Wait until the campaign's time window opens
 * @param {string} timeWindowStart - Start time in HH:MM format
 * @param {string} timeWindowEnd - End time in HH:MM format
 * @returns {Promise<void>} - Resolves when the time window opens
 */
async function waitUntilTimeWindow(timeWindowStart, timeWindowEnd) {
  // If no time window is set, no need to wait
  if (!timeWindowStart || !timeWindowEnd) return;
  
  // If already in time window, no need to wait
  if (isWithinTimeWindow(timeWindowStart, timeWindowEnd)) return;
  
  const [startHours, startMinutes] = timeWindowStart.split(':').map(Number);
  const now = new Date();
  
  // Set target time to today's date with the specified hours and minutes
  const targetTime = new Date();
  targetTime.setHours(startHours, startMinutes, 0, 0);
  
  // If target time is in the past, set it to tomorrow
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  // Calculate milliseconds to wait
  const waitTime = targetTime.getTime() - now.getTime();
  
  // Wait until the time window opens
  return new Promise(resolve => setTimeout(resolve, waitTime));
}

module.exports = {
  isWithinTimeWindow,
  waitUntilTimeWindow
}; 