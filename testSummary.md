# Test Summary

## Environment

- App URL: `http://localhost:3001`
- Test mode: Playwright headed mode
- Main test file used: `test-75mb.bin` around 75 MB
- Additional files used: `test-small.txt`, `test-tiny.txt`
- Sender page: `/`
- Receiver page: generated `/download/:slug` share link

## Results

| # | Test Case | Result | Summary |
|---|---|---|---|
| 1 | Open sender, select 2-3 files, confirm staged list | PASS | Sender opened successfully. Three files were selected and the staged list showed file names and sizes. |
| 2 | Remove one staged file, confirm others remain | PASS | One staged file was removed. The remaining files stayed visible in the staged list. |
| 3 | Remove all files one by one, UI returns to initial state | PASS | After removing all files, the staged panel was hidden, Pause/Cancel controls were hidden, and the file picker returned. |
| 4 | Re-select files, Pause/Cancel appear | PASS | Pause/Cancel controls were hidden before selection and appeared after files were selected again. |
| 5 | Confirm hosting creates zip and get share link | PASS | Hosting was created successfully, selected files were zipped as `files.zip`, and a share link was generated. |
| 6 | Open receiver in second context using share link | PASS | Receiver opened successfully with the generated share link and showed `files.zip` ready to download. |
| 7 | Start download, receiver progress bar updates | PASS | Receiver download started and the progress bar updated correctly within the `0-100` range. |
| 8 | Sender tab shows per-peer progress bar in sync | PASS | Sender showed a per-peer progress entry for the first receiver: `Peer 1: 100%`. |
| 9 | Second receiver tab, sender shows two bars independently | PASS | A second receiver downloaded from the same share link, and sender showed two peer progress entries. |
| 10 | Receivers end with `files.zip` downloaded and done status | PASS | Both receivers completed successfully with status `File saved.` and downloaded `files.zip`. |

## Important Observations

- The earlier receiver progress bug was fixed. The progress value previously jumped above `100` because byte counts were written directly to the progress bar.
- The receiver progress bar now uses `max = 100` and writes a clamped percentage value.
- The remove button layout issue was fixed and verified across responsive widths down to 320px.
- Both receiver downloads completed successfully.

## Final Status

All 10 end-to-end checklist items passed.
