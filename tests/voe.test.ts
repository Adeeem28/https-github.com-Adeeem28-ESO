import test from 'node:test';
import assert from 'node:assert/strict';
import {voeNotes} from '../lib/voe';
test('transfer reason stays separate from the management response',()=>{
 assert.deepEqual(voeNotes('Reclassified from ESO: Workplace concern','eso1','Recorded reason'),{adminNote:undefined,transferReason:'Recorded reason'});
 assert.deepEqual(voeNotes('We have ordered new equipment','eso1','Recorded reason'),{adminNote:'We have ordered new equipment',transferReason:'Recorded reason'});
 assert.deepEqual(voeNotes('Reclassified from ESO: Legacy reason','eso1'),{adminNote:undefined,transferReason:'Legacy reason'});
 assert.deepEqual(voeNotes('Direct response',null),{adminNote:'Direct response',transferReason:undefined});
});
