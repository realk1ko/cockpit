import cockpit from "cockpit";
import QUnit from "qunit-tests";

QUnit.test("simple process", function (assert) {
    const done = assert.async();
    assert.expect(2);
    cockpit.spawn(["/bin/sh", "-c", "echo hi"])
            .done(function(resp) {
                assert.equal(resp, "hi\n", "returned output");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                done();
            });
});

QUnit.test("path", function (assert) {
    const done = assert.async();
    assert.expect(1);
    cockpit.spawn(["true"])
            .always(function() {
                assert.equal(this.state(), "resolved", "found executable");
                done();
            });
});

QUnit.test("directory", function (assert) {
    const done = assert.async();
    assert.expect(2);
    cockpit.spawn(["pwd"], { directory: "/tmp" })
            .done(function(resp) {
                assert.equal(resp, "/tmp\n", "was right");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                done();
            });
});

QUnit.test("error log", function (assert) {
    const done = assert.async();
    assert.expect(2);
    cockpit.spawn(["/bin/sh", "-c", "echo hi; echo yo >&2"])
            .done(function(resp) {
                assert.equal(resp, "hi\n", "produced no output");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                done();
            });
});

QUnit.test("error output", function (assert) {
    const done = assert.async();
    assert.expect(2);
    cockpit.spawn(["/bin/sh", "-c", "echo hi; echo yo >&2"], { err: "out" })
            .done(function(resp) {
                assert.equal(resp, "hi\nyo\n", "showed up");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                done();
            });
});

QUnit.test("error message", function (assert) {
    const done = assert.async();
    assert.expect(3);
    cockpit.spawn(["/bin/sh", "-c", "echo hi; echo yo >&2"], { err: "message" })
            .done(function(resp, message) {
                assert.equal(resp, "hi\n", "produced output");
                assert.equal(message, "yo\n", "produced message");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                done();
            });
});

QUnit.test("error message fail", function (assert) {
    const done = assert.async();
    assert.expect(3);
    cockpit.spawn(["/bin/sh", "-c", "echo hi; echo yo >&2; exit 2"], { err: "message" })
            .fail(function(ex, resp) {
                assert.equal(resp, "hi\n", "produced output");
                assert.equal(ex.message, "yo", "produced message");
            })
            .always(function() {
                assert.equal(this.state(), "rejected", "didn't fail");
                done();
            });
});

QUnit.test("nonexisting executable", assert => {
    assert.rejects(cockpit.spawn(["/bin/nonexistent"]),
                   ex => ex.problem == "not-found");
});

QUnit.test("permission denied", assert => {
    assert.rejects(cockpit.spawn(["/etc/hostname"]),
                   ex => ex.problem == "access-denied");
});

QUnit.test("write eof read", function (assert) {
    const done = assert.async();
    assert.expect(2);

    const proc = cockpit.spawn(["/usr/bin/sort"]);

    proc.done(function(resp) {
        assert.equal(resp, "1\n2\n3\n", "output");
    });

    proc.always(function() {
        assert.equal(this.state(), "resolved", "didn't fail");
        done();
    });

    proc.input("2\n", true);
    proc.input("3\n1\n");
});

QUnit.test("stream", function (assert) {
    const done = assert.async();
    assert.expect(4);

    let streamed = 0;
    let result = "";
    const proc = cockpit.spawn(["/bin/cat"])
            .stream(function(resp) {
                result += resp;
                streamed += 1;
            })
            .done(function(resp) {
                assert.equal(resp, "", "no done data");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                assert.equal(result, "11\n22\n33\n", "stream data");
                assert.ok(streamed > 0, "stream handler called");
                done();
            });

    proc.input("11\n", true);
    proc.input("22\n", true);
    proc.input("33\n");
});

QUnit.test("stream packets", function (assert) {
    const done = assert.async();
    assert.expect(3);

    let streamed = "";
    const proc = cockpit.spawn(["/bin/cat"])
            .stream(function(resp) {
                streamed += resp;
            })
            .done(function(resp) {
                assert.equal(resp, "", "no done data");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                assert.equal(streamed, "11\n22\n33\n", "stream data");
                done();
            });

    proc.input("11\n", true);
    proc.input("22\n", true);
    proc.input("33\n");
});

QUnit.test("stream replaced", function (assert) {
    const done = assert.async();
    assert.expect(3);

    let first = false;
    let second = false;

    const proc = cockpit.spawn(["/bin/cat"])
            .stream(function(resp) {
                first = true;
            })
            .stream(function(resp) {
                second = true;
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                assert.ok(!first, "first stream handler not called");
                assert.ok(second, "second stream handler called");
                done();
            });

    proc.input("11\n", true);
    proc.input("22\n", true);
    proc.input("33\n");
});

QUnit.test("stream partial", function (assert) {
    const done = assert.async();
    assert.expect(3);

    let streamed = "";
    const proc = cockpit.spawn(["/bin/cat"])
            .stream(function(resp) {
                if (resp.length > 0) {
                    streamed += resp[0];
                    return 1;
                }
            })
            .done(function(resp) {
                assert.equal(resp, "234", "right done data");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                assert.equal(streamed, "1", "stream data");
                done();
            });

    proc.input("1234");
});

QUnit.test("stream partial binary", function (assert) {
    const done = assert.async();
    assert.expect(3);

    const streamed = [];
    const proc = cockpit.spawn(["/bin/cat"], { binary: true })
            .stream(function(resp) {
                if (resp.length > 0) {
                    streamed.push(resp[0]);
                    return 1;
                }
            })
            .done(function(resp) {
                assert.equal(resp.length, 3, "right done data");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                assert.deepEqual(streamed, [49], "stream data");
                done();
            });

    proc.input("1234");
});

QUnit.test("script with input", function (assert) {
    const done = assert.async();
    assert.expect(2);

    const script = "#!/bin/sh\n\n# Test\n/usr/bin/sort\necho $2\necho $1";

    const proc = cockpit.script(script, ["5", "4"]);

    proc.done(function(resp) {
        assert.equal(resp, "1\n2\n3\n4\n5\n", "output matched");
    });

    proc.always(function() {
        assert.equal(this.state(), "resolved", "didn't fail");
        done();
    });

    proc.input("2\n", true);
    proc.input("3\n1\n");
});

QUnit.test("script with options", function (assert) {
    const done = assert.async();
    assert.expect(2);

    const script = "#!/bin/sh\n\n# Test\n/usr/bin/sort\necho $2\necho $1 >&2";

    const proc = cockpit.script(script, ["5", "4"], { err: "out" });

    proc.done(function(resp) {
        assert.equal(resp, "1\n2\n3\n4\n5\n", "output matched");
    });

    proc.always(function() {
        assert.equal(this.state(), "resolved", "didn't fail");
        done();
    });

    proc.input("2\n", true);
    proc.input("3\n1\n");
});

QUnit.test("script without args", function (assert) {
    const done = assert.async();
    assert.expect(2);

    const script = "#!/bin/sh\n\n# Test\n/usr/bin/sort >&2";

    const proc = cockpit.script(script, { err: "out" });

    proc.done(function(resp) {
        assert.equal(resp, "1\n2\n3\n", "output matched");
    });

    proc.always(function() {
        assert.equal(this.state(), "resolved", "didn't fail");
        done();
    });

    proc.input("2\n", true);
    proc.input("3\n1\n");
});

QUnit.test("pty", async function (assert) {
    const proc = cockpit.spawn(['sh', '-c', "tty; test -t 0"], { pty: true });
    const output = await proc.done();
    assert.equal(output.indexOf('/dev/pts'), 0, 'TTY is a pty: ' + output);
});

QUnit.test("pty window size", async function (assert) {
    const proc = cockpit.spawn(['tput', 'lines', 'cols'], { pty: true, window: { rows: 77, cols: 88 } });
    const output = await proc.done();
    assert.equal(output, '77\r\n88\r\n', 'Correct rows and columns');
});

QUnit.test("stream large output", function (assert) {
    const done = assert.async();
    assert.expect(4);

    let lastblock = null;
    cockpit.spawn(["seq", "10000000"])
            .stream(function(resp) {
                if (lastblock === null)
                    assert.equal(resp.slice(0, 4), "1\n2\n", "stream data starts with first numbers");
                lastblock = resp;
            })
            .then(function(resp) {
                assert.equal(resp, "", "no done data");
            })
            .always(function() {
                assert.equal(this.state(), "resolved", "didn't fail");
                assert.equal(lastblock.slice(-18), "\n9999999\n10000000\n", "stream data has last numbers");
                done();
            });
});

QUnit.start();
