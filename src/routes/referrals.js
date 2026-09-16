import { Router } from 'express';
import { requireMember } from '../middleware/auth.js';
import { getOrIssueCode, listFor, ledgerFor, balanceFor } from '../lib/referrals.js';

const router = Router();
router.use(requireMember);

router.get('/me', (req, res) => {
  const code = getOrIssueCode(req.user.id);
  res.json({
    ok: true,
    code,
    link: (process.env.PUBLIC_URL || '').replace(/\/$/, '') + '/index.html?ref=' + encodeURIComponent(code || ''),
    balance_months: balanceFor(req.user.id),
    referrals: listFor(req.user.id),
    ledger:    ledgerFor(req.user.id),
  });
});

export default router;
