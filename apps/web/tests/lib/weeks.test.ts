import { describe, it, expect } from 'vitest';
import { getChallengeWeekNumber, getWeekDateRange, getTotalWeeks } from '../../../../packages/backend/lib/weeks';

describe('weeks utilities', () => {
  // Challenge starts Jan 1, 2024
  const startDate = '2024-01-01';
  const startMs = Date.UTC(2024, 0, 1); // Jan 1, 2024 00:00 UTC

  describe('getChallengeWeekNumber', () => {
    it('should return week 1 for the challenge start date', () => {
      expect(getChallengeWeekNumber(startDate, startMs)).toBe(1);
    });

    it('should return week 1 for day 6 (last day of first week)', () => {
      const day6 = Date.UTC(2024, 0, 7); // Jan 7
      expect(getChallengeWeekNumber(startDate, day6)).toBe(1);
    });

    it('should return week 2 for day 7 (first day of second week)', () => {
      const day7 = Date.UTC(2024, 0, 8); // Jan 8
      expect(getChallengeWeekNumber(startDate, day7)).toBe(2);
    });

    it('should return week 4 for day 21', () => {
      const day21 = Date.UTC(2024, 0, 22); // Jan 22
      expect(getChallengeWeekNumber(startDate, day21)).toBe(4);
    });

    it('should return 0 for a date before the challenge starts', () => {
      const before = Date.UTC(2023, 11, 31); // Dec 31, 2023
      expect(getChallengeWeekNumber(startDate, before)).toBe(0);
    });

    it('should handle numeric startDate (ms timestamp)', () => {
      expect(getChallengeWeekNumber(startMs, startMs)).toBe(1);
    });

    it('should handle mid-day timestamps', () => {
      // 3pm on Jan 1 should still be week 1
      const midDay = Date.UTC(2024, 0, 1, 15, 30, 0);
      expect(getChallengeWeekNumber(startDate, midDay)).toBe(1);
    });

    it('should handle end-of-day timestamps at week boundary', () => {
      // 23:59 on Jan 7 (day 6) should still be week 1
      const endOfDay6 = Date.UTC(2024, 0, 7, 23, 59, 59);
      expect(getChallengeWeekNumber(startDate, endOfDay6)).toBe(1);

      // 00:00 on Jan 8 (day 7) should be week 2
      const startOfDay7 = Date.UTC(2024, 0, 8, 0, 0, 0);
      expect(getChallengeWeekNumber(startDate, startOfDay7)).toBe(2);
    });
  });

  describe('getWeekDateRange', () => {
    it('should return correct range for week 1', () => {
      const { start, end } = getWeekDateRange(startDate, 1);
      expect(start).toBe(Date.UTC(2024, 0, 1));
      expect(end).toBe(Date.UTC(2024, 0, 8));
    });

    it('should return correct range for week 2', () => {
      const { start, end } = getWeekDateRange(startDate, 2);
      expect(start).toBe(Date.UTC(2024, 0, 8));
      expect(end).toBe(Date.UTC(2024, 0, 15));
    });

    it('should return correct range for week 4', () => {
      const { start, end } = getWeekDateRange(startDate, 4);
      expect(start).toBe(Date.UTC(2024, 0, 22));
      expect(end).toBe(Date.UTC(2024, 0, 29));
    });

    it('should produce non-overlapping consecutive ranges', () => {
      const week1 = getWeekDateRange(startDate, 1);
      const week2 = getWeekDateRange(startDate, 2);
      expect(week1.end).toBe(week2.start);
    });

    it('should produce 7-day ranges', () => {
      const msPerDay = 1000 * 60 * 60 * 24;
      for (let week = 1; week <= 5; week++) {
        const { start, end } = getWeekDateRange(startDate, week);
        expect(end - start).toBe(7 * msPerDay);
      }
    });

    it('should handle numeric startDate', () => {
      const { start, end } = getWeekDateRange(startMs, 1);
      expect(start).toBe(Date.UTC(2024, 0, 1));
      expect(end).toBe(Date.UTC(2024, 0, 8));
    });
  });

  describe('getTotalWeeks', () => {
    it('should return 1 for 7 days', () => {
      expect(getTotalWeeks(7)).toBe(1);
    });

    it('should return 2 for 8 days (ceil)', () => {
      expect(getTotalWeeks(8)).toBe(2);
    });

    it('should return 4 for exactly 28 days', () => {
      expect(getTotalWeeks(28)).toBe(4);
    });

    it('should return 5 for 30 days (ceil)', () => {
      expect(getTotalWeeks(30)).toBe(5);
    });

    it('should return 1 for 1 day', () => {
      expect(getTotalWeeks(1)).toBe(1);
    });
  });

  describe('getChallengeWeekNumber + getWeekDateRange round-trip', () => {
    it('should place dates within the correct week range', () => {
      for (let week = 1; week <= 4; week++) {
        const { start, end } = getWeekDateRange(startDate, week);
        // Start of week should be in this week
        expect(getChallengeWeekNumber(startDate, start)).toBe(week);
        // End of week (exclusive) should be in the next week
        expect(getChallengeWeekNumber(startDate, end)).toBe(week + 1);
        // Mid-week should be in this week
        const mid = start + (end - start) / 2;
        expect(getChallengeWeekNumber(startDate, mid)).toBe(week);
      }
    });
  });
});
