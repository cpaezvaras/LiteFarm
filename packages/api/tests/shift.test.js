const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const server = require('./../src/server');
const knex = require('../src/util/knex');
const { tableCleanup } = require('./testEnvironment')
jest.mock('jsdom')
jest.mock('../src/middleware/acl/checkJwt')
const mocks = require('./mock.factories');

describe('Shift tests', () => {
  let middleware;
  beforeAll(() => {
    middleware = require('../src/middleware/acl/checkJwt');
    middleware.mockImplementation((req, res, next) => {
      req.user = {};
      req.user.sub = '|' + req.get('user_id');
      next()
    });
  });

  afterEach(async (done) => {
    await tableCleanup(knex);
    done();
  });

  afterAll(async (done) => {
    await knex.destroy();
    done();
  });

  function getShiftsAtFarm({ user_id, farm_id }, callback) {
    chai
      .request(server)
      .get(`/shift/farm/${farm_id}`)
      .set('user_id', user_id)
      .set('farm_id', farm_id)
      .end(callback);
  }

  function getMyShifts({ user_id, farm_id }, callback) {
    chai
      .request(server)
      .get(`/shift/user/${user_id}`)
      .set('user_id', user_id)
      .set('farm_id', farm_id)
      .end(callback);
  }

  async function appendUserFarmAShiftTask({ user_id, farm_id }) {
    let userShift = await mocks.shiftFactory({ promisedUser: [{ user_id }] });
    let fieldForFarm = await mocks.fieldFactory({ promisedFarm: [{ farm_id }] })
    let fieldCropForField = await mocks.fieldCropFactory({ promisedField: fieldForFarm });
    let shift = await mocks.shiftFactory({ promisedUser: [{ user_id }] })
    let shiftTask = await mocks.shiftTaskFactory({
      promisedShift: shift,
      promisedField: fieldForFarm,
      promisedFieldCrop: fieldCropForField
    })
  }


  describe('At my farm', () => {
    test('get shifts at my farm', async (done) => {
      let [{ user_id, farm_id }] = await mocks.userFarmFactory();
      let [differentFarmForTheSameUser] = await mocks.userFarmFactory({ promisedUser: [{ user_id }] });
      await appendUserFarmAShiftTask({user_id, farm_id});
      await appendUserFarmAShiftTask({user_id, farm_id: differentFarmForTheSameUser.farm_id})
      getShiftsAtFarm({ user_id, farm_id }, (err, res) => {
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        done();
      })
    })
  })
})
