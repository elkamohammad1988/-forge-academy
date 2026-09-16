import { Router } from 'express';
import { listFor, streakDays } from '../lib/achievements.js';
import { requireMember } from '../middleware/auth.js';

const router = Router();
router.use(requireMember);

router.get('/me', (req, res) => {
  res.json({
    ok: true,
    badges: listFor(req.user.id),
    streak_days: streakDays(req.user.id),
  });
});

export default router;
