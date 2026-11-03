import test from 'node:test'
import assert from 'node:assert/strict'
import { nochesDemo } from '../src/lib/demo-estancia'

test('demo calcula noches y cruces de mes sin zona horaria local', () => {
  assert.equal(nochesDemo('2027-03-19', '2027-03-22'), 3)
  assert.equal(nochesDemo('2027-02-28', '2027-03-02'), 2)
})
test('demo rechaza fechas imposibles, vacías, invertidas o más de 90 noches', () => {
  for (const [start, end] of [['', '2027-03-22'], ['2027-02-30', '2027-03-22'], ['2027-03-22', '2027-03-22'], ['2027-03-23', '2027-03-22'], ['2027-01-01', '2027-05-01']]) assert.equal(nochesDemo(start, end), null)
  assert.equal(nochesDemo('2027-01-01', '2027-04-01'), 90)
})
