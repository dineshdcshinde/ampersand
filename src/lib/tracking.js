/**
 * @file Recognise analytics and ad-tracking params (utm_*, gclid, fbclid…).
 * Used for the "these are tracking params → Remove" notice and the
 * "Copy without tracking" action.
 */

/** Exact key names used by ad platforms and marketing tools. Compared in lower case. */
const TRACKING_KEYS = new Set([
  // Google Ads / Analytics
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid', '_ga', '_gl', 'srsltid',
  // Meta, Microsoft, TikTok, X, LinkedIn, Instagram, Yandex
  'fbclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'igshid', 'igsh', 'yclid',
  // Email and marketing automation (Mailchimp, HubSpot, Marketo, Vero…)
  'mc_cid', 'mc_eid', '_hsenc', '_hsmi', '__hstc', '__hssc', '__hsfp', 'hsctatracking',
  'mkt_tok', 'vero_id', 'vero_conv', 'oly_anon_id', 'oly_enc_id', 'wickedid',
  // Affiliate and misc
  'rb_clickid', 's_cid', 'ref_src', 'ref_url', 'epik', 'scid', 'sc_cid', 'trk',
  'trkcampaign', 'cmpid', 'zanpid', 'irclickid',
]);

/** Key prefixes that are always tracking: utm_source, pk_campaign, mtm_kwd… */
const TRACKING_PREFIX = /^(utm_|pk_|mtm_|piwik_|matomo_|hsa_)/i;

/**
 * Is this param key a known tracking param?
 *
 * @param {string} key Decoded param key.
 * @returns {boolean}
 */
export function isTrackingKey(key) {
  return Boolean(key) && (TRACKING_PREFIX.test(key) || TRACKING_KEYS.has(key.toLowerCase()));
}

/** The standard UTM set, added by "Add UTM params". */
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
