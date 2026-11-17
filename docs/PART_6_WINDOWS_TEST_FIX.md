# Part 6 Windows test correction - P6-WIN-TEST-1

Date: 3 October 2026. Calculation engine remains 0.2.0; project schema remains 1.

## What your console output shows

Your Node 24.20.0 is within the supported range. Package integrity and startup preflight both passed. Of 61 original tests, 60 passed. The failed assertion is in the test's process-stop check after a successful calculation and saved-project response, before the child-process restart was attempted.

The original startup test sent SIGTERM to its child server and demanded exit code 0. On Windows, Node emulates that request with unconditional termination; the parent receives a signal termination and a null exit code. The test discarded the signal and therefore failed with null !== 0.

This was a portability defect in the supplied test. It does not show a failed hydraulic calculation or failed save. Persistence across a whole process restart still needs the corrected test to finish on your Windows computer.

The separate "Backend request failed: EEXIST" message was produced intentionally by the API storage-failure test. That test temporarily puts a regular file where its temporary storage directory should be and checks for HTTP 500. It passed. This correction captures and asserts that expected log inside the test; real application error logging remains enabled.

## Apply the small patch to the existing installation

1. If the application is running, save your draft and stop it with Ctrl+C.
2. Download and extract Orifice_Part_6_Windows_Test_Fix.zip to a temporary folder.
3. Inside the extracted patch, copy **README.md**, **tests** and **docs** into your existing **orifice-part-6** folder (the one containing package.json).
4. Merge the folders and choose **Replace the files in the destination** for the included files. Do not replace/delete the entire project directory. The patch contains no storage folder and does not alter saved projects.
5. Open Command Prompt in the existing orifice-part-6 folder and run:

~~~bat
npm run verify:package
npm test
~~~

The intended test summary is **62 tests, 62 pass, 0 fail**. One new regression test verifies expected termination outcomes and rejects crashes/watchdog timeouts.

If package verification reports a changed or missing file, ensure all patch contents were copied, including docs/part6/release-manifest.json. Do not edit or skip the integrity checker to make it pass.

Start the application with:

~~~bat
npm start
~~~

Then open <http://127.0.0.1:3000>. Keep the terminal open. There is no need to reinstall Node, run npm install, remove saved projects or change OneDrive settings for this specific failure.

## Alternative: complete package

The corrected Orifice_Part_6_Complete_Package.zip also includes this fix. For a fresh extraction, preserve your existing storage folder or portable JSON backups before moving to a new working folder. Applying the small patch is simpler for your current installation.

## What changed

- tests/startup.test.mjs retains both child-process exit code and signal.
- Requested stops accept a normal successful exit, or specifically code null / signal SIGTERM on Windows. Other nonzero exits, absent termination information, SIGKILL and unexpected signals still fail.
- Both stop points use that check; the test still restarts the actual server and compares saved inputs/revision.
- Cleanup no longer treats a child already terminated by a signal as a running process.
- tests/api.test.mjs captures and validates only its deliberate storage-error log, restoring logging afterward.
- README, correction evidence and the release manifest identify this test-only update.

Application source, UI, launcher, equations, catalogs, imports, original workbook and example projects remain byte-for-byte unchanged from the original Part 6 package. No results or engineering-approval flags were modified.

## Verification scope

The full corrected suite was run on Linux with Node 24.19.0: **62 passed, 0 failed**. The regression test explicitly exercises Windows termination result objects and rejects incorrect outcomes. This is not a native Windows execution; your rerun is the remaining platform confirmation.

The user's original Windows log is evidence for 60 passing original tests and the specific termination assertion failure. Browser checks were not repeated because application/UI code is unchanged. Earlier Part 6 evidence remains historical. Independent engineering approval remains pending.

## Official technical references

- [Node 24 signal behavior on Windows](https://nodejs.org/docs/latest-v24.x/api/process.html#signal-events)
- [Node child-process close event: exit code and signal](https://nodejs.org/api/child_process.html#event-close)

Checked 3 October 2026. These explain why a signal termination has a null exit code and why Windows SIGTERM differs from a POSIX graceful-stop handler.
