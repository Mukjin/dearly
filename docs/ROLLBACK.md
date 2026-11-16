# DEARLY typography rollback

Published site: https://wv1786969114656754.zaemit.ai/#studio
Component: M6a9d8094462fa1543309
Confirmed server restore point: 105 (restorable=true).
To undo this typography update: component_restore with restore_point=105.
Do not use 104: that also reverts the preceding drag-and-drop improvement.
If subsequent unrelated edits exist, reverse only this patch instead of restoring the whole component.

Files:
footer.before.js SHA256 1b846e00d842b7a6da968e0241cae9af65df9b06b1684d6f49a94ec12ce6f1e0
footer.after.js SHA256 eb9b05d386477c20e03b6f83fe00a39be99f305544fa0ae52c3daed40d653e43

Verified: syntax and serialization; invalid/legacy fallback; all three fonts update actual invitation DOM; browser reload restores selected hand font; 390px layout has no horizontal overflow; update accepted by server without warnings.
Public source backup may contain platform scope alias __zsScopeRoot. Prefer server restore point for exact rollback.

Security patch note: the checked-in before-typography copies now include the guest sharing URL binding fix. They retain the earlier typography but are no longer byte-for-byte copies of the original snapshot. The hashes above identify historical platform exports; docs/checksums.json identifies the current checked-in files. A platform restore point may predate the fix: reapply the guest sharing fix and run the share-context tests before publishing restored code. Updating this repository does not update the hosted Zaemit component automatically.
