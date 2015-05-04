﻿// Copyright (c) 2015 Vadim Macagon
// MIT License, see LICENSE file for full terms.

/// <reference path="../typings/test/tsd.d.ts" />

require('source-map-support').install();

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import dbgmits = require('../src/dbgmits');
import testUtils = require('../test/test_utils');

chai.use(chaiAsPromised);

// aliases
import expect = chai.expect;
import DebugSession = dbgmits.DebugSession;
import runToFuncAndStepOut = testUtils.runToFuncAndStepOut;

// the directory in which Gruntfile.js resides is also Mocha's working directory,
// so any relative paths will be relative to that directory
var localTargetExe: string = './build/Debug/data_tests_target';

describe("Data Inspection and Manipulation", () => {
  var debugSession: DebugSession;

  beforeEach(() => {
    debugSession = dbgmits.startDebugSession();
    return debugSession.setExecutableFile(localTargetExe);
  });

  afterEach(() => {
    return debugSession.end();
  });

  it("evaluates expressions", () => {
    return runToFuncAndStepOut(debugSession, 'expressionEvaluationBreakpoint', () => {
      return debugSession.evaluateExpression('a')
      .then((value: string) => { expect(value).to.equal('1'); })
      .then(() => { return debugSession.evaluateExpression('a + b'); })
      .then((value: string) => { expect(value).to.equal('3'); })
      .then(() => { return debugSession.evaluateExpression('c.x * c.y'); })
      .then((value: string) => { expect(value).to.equal('25'); })
      .then(() => { return debugSession.evaluateExpression('get10()'); })
      .then((value: string) => { expect(value).to.equal('10'); })
      .then(() => { return debugSession.evaluateExpression('get10() * get10()'); })
      .then((value: string) => { expect(value).to.equal('100'); })
      .then(() => { return debugSession.evaluateExpression('get10() == 10'); })
      .then((value: string) => { expect(value).to.equal('true'); })
      .then(() => { return debugSession.evaluateExpression('get10() == getInt(10)'); })
      .then((value: string) => { expect(value).to.equal('true'); })
      .then(() => { 
        return debugSession.evaluateExpression('a == 1', { threadId: 1, frameLevel: 0 }); 
      })
      .then((value: string) => { expect(value).to.equal('true'); });
    });
  });

  it("reads memory at an address specified as a hex literal", () => {
    return runToFuncAndStepOut(debugSession, 'memoryAccessBreakpoint', () => {
      var theAddr;
      return debugSession.evaluateExpression('&array')
      .then((address: string) => {
        theAddr = address;
        return debugSession.readMemory(address, 4);
      })
      .then((blocks: dbgmits.IMemoryBlock[]) => {
        expect(blocks.length).to.equal(1);
        expect(blocks[0]).to.have.property('begin', theAddr);
        expect(blocks[0]).to.have.property('end');
        expect(blocks[0]).to.have.property('offset');
        expect(blocks[0]).to.have.property('contents', '01020304');
      });
    });
  });

  // FIXME: re-enable when LLDB-MI is fixed to accept expressions for -data-read-memory-bytes
  it.skip("reads memory at an address obtained from an expression", () => {
    return runToFuncAndStepOut(debugSession, 'memoryAccessBreakpoint', () => {
      return debugSession.readMemory('&array', 4)
      .then((blocks: dbgmits.IMemoryBlock[]) => {
        expect(blocks.length).to.equal(1);
        expect(blocks[0]).to.have.property('contents', '01020304');
      });
    });
  });

  // FIXME: re-enable when LLDB-MI is fixed to use the offset for -data-read-memory-bytes
  it.skip("reads memory at an address with an offset", () => {
    return runToFuncAndStepOut(debugSession, 'memoryAccessBreakpoint', () => {
      var theAddr;
      return debugSession.evaluateExpression('&array')
      .then((address: string) => {
        theAddr = address;
        return debugSession.readMemory(address, 2, { byteOffset: 2 });
      })
      .then((blocks: dbgmits.IMemoryBlock[]) => {
        expect(blocks.length).to.equal(1);
        expect(blocks[0]).to.have.property('contents', '0304');
      });
    });
  });

  it("gets a list of register names", () => {
    var onBreakpointGetRegisterNames = new Promise<void>((resolve, reject) => {
      debugSession.once(DebugSession.EVENT_BREAKPOINT_HIT,
        (breakNotify: dbgmits.BreakpointHitNotify) => {
          debugSession.getRegisterNames()
          .then((registerNames: string[]) => { expect(registerNames.length).to.be.greaterThan(0); })
          .then(() => { return debugSession.getRegisterNames([1, 2, 3]); })
          .then((registerNames: string[]) => { expect(registerNames.length).to.equal(3); })
          .then(resolve)
          .catch(reject);
        }
      );
    });
    // add breakpoint to get to the starting point of the test
    return debugSession.addBreakpoint('main')
    .then(() => {
      return Promise.all([
        onBreakpointGetRegisterNames,
        debugSession.startTarget()
      ])
    });
  });
});
