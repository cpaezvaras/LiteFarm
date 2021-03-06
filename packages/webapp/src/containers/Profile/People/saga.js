import { call, put, takeLatest, select } from 'redux-saga/effects';
import apiConfig from '../../../apiConfig';
import { toastr } from 'react-redux-toastr';
import { loginSelector } from '../../userFarmSlice';
import { getHeader } from '../../saga';
import {
  getUserFarmsSuccess,
  putUserSuccess,
  postUserSuccess,
  patchUserStatusSuccess,
  onLoadingUserFarmsFail,
  onLoadingUserFarmsStart,
} from '../../userFarmSlice';
import { createAction } from '@reduxjs/toolkit';
import { onLoadingRolesStart, onLoadingRolesFail, getRolesSuccess } from './slice';
import i18n from '../../../lang/i18n';

const axios = require('axios');

export const getAllUserFarmsByFarmId = createAction('getAllUserFarmsByFarmIDSaga');

export function* getAllUserFarmsByFarmIDSaga() {
  const { user_id, farm_id } = yield select(loginSelector);
  const header = getHeader(user_id, farm_id);
  const { userFarmUrl } = apiConfig;
  try {
    yield put(onLoadingUserFarmsStart());
    // only non-deleted users
    const result = yield call(axios.get, userFarmUrl + '/farm/' + farm_id, header);
    yield put(getUserFarmsSuccess(result.data));
  } catch (e) {
    yield put(onLoadingUserFarmsFail(e));
    console.log('failed to fetch users from database');
  }
}

export const addUser = createAction('addUserSaga');

export function* addUserSaga({ payload: user }) {
  const { user_id, farm_id } = yield select(loginSelector);
  const header = getHeader(user_id, farm_id);
  user.farm_id = farm_id;
  const { inviteUserUrl } = apiConfig;

  try {
    const result = yield call(axios.post, inviteUserUrl, user, header);
    //TODO post should return id. Remove nested saga call.

    yield put(postUserSuccess(result.data));
    toastr.success(i18n.t('message:USER.SUCCESS.ADD'));
  } catch (err) {
    //console.log(err.response.status);
    if (err.response.status === 409) {
      toastr.error(i18n.t('message:USER.ERROR.EXISTS'));
    } else toastr.error(i18n.t('message:USER.ERROR.ADD'));
  }
}

export const addPseudoWorker = createAction('addPseudoWorkerSaga');

export function* addPseudoWorkerSaga({ payload: user }) {
  const { pseudoUserUrl } = apiConfig;
  const { user_id, farm_id } = yield select(loginSelector);
  const header = getHeader(user_id, farm_id);
  user.farm_id = farm_id;

  try {
    const result = yield call(axios.post, pseudoUserUrl, user, header);
    yield put(postUserSuccess(result.data));
    toastr.success(i18n.t('message:USER.SUCCESS.ADD'));
  } catch (err) {
    console.error(err);
    toastr.error(i18n.t('message:USER.ERROR.ADD'));
  }
}

export const deactivateUser = createAction('deactivateUserSaga');

export function* deactivateUserSaga({ payload: target_user_id }) {
  const { userFarmUrl } = apiConfig;
  const { user_id, farm_id } = yield select(loginSelector);
  const header = getHeader(user_id, farm_id);
  const body = {
    status: 'Inactive',
  };

  try {
    const result = yield call(
      axios.patch,
      `${userFarmUrl}/status/farm/${farm_id}/user/${target_user_id}`,
      body,
      header,
    );
    yield put(patchUserStatusSuccess({ farm_id, user_id: target_user_id, ...body }));
    toastr.success(i18n.t('message:USER.SUCCESS.REVOKE'));
  } catch (e) {
    toastr.error(i18n.t('message:USER.ERROR.REVOKE'));
  }
}

export const reactivateUser = createAction('reactivateUserSaga');

export function* reactivateUserSaga({ payload: target_user_id }) {
  const { userFarmUrl } = apiConfig;
  const { user_id, farm_id } = yield select(loginSelector);
  const header = getHeader(user_id, farm_id);

  const body = {
    status: 'Active',
  };

  try {
    const result = yield call(
      axios.patch,
      `${userFarmUrl}/status/farm/${farm_id}/user/${target_user_id}`,
      body,
      header,
    );
    yield put(patchUserStatusSuccess({ farm_id, user_id: target_user_id, ...body }));
    toastr.success(i18n.t('message:USER.SUCCESS.RESTORE'));
  } catch (e) {
    toastr.error(i18n.t('message:USER.ERROR.RESTORE'));
  }
}

export const updateUserFarm = createAction('updateUserFarmSaga');

export function* updateUserFarmSaga({ payload: user }) {
  let target_user_id = user.user_id;
  const { user_id, farm_id } = yield select(loginSelector);
  const header = getHeader(user_id, farm_id);
  try {
    delete user.user_id;
    const result = yield call(
      axios.patch,
      apiConfig.userFarmUrl + '/update/' + `farm/${farm_id}/user/${target_user_id}`,
      user,
      header,
    );
    yield put(putUserSuccess({ ...user, farm_id, user_id: target_user_id }));
    toastr.success(i18n.t('message:USER.SUCCESS.UPDATE'));
  } catch (e) {
    toastr.error(i18n.t('message:USER.ERROR.UPDATE'));
    console.error(e);
  }
}

export const getRoles = createAction('getRolesSaga');

export function* getRolesSaga() {
  const { rolesUrl } = apiConfig;
  const { user_id, farm_id } = yield select(loginSelector);
  const header = getHeader(user_id, farm_id);
  try {
    yield put(onLoadingRolesStart());
    const result = yield call(axios.get, rolesUrl, header);
    yield put(getRolesSuccess(result.data));
  } catch (e) {
    yield put(onLoadingRolesFail());
    console.log('failed to fetch roles from database');
  }
}

export default function* peopleSaga() {
  yield takeLatest(getAllUserFarmsByFarmId.type, getAllUserFarmsByFarmIDSaga);
  yield takeLatest(addUser.type, addUserSaga);
  yield takeLatest(addPseudoWorker.type, addPseudoWorkerSaga);
  yield takeLatest(deactivateUser.type, deactivateUserSaga);
  yield takeLatest(updateUserFarm.type, updateUserFarmSaga);
  yield takeLatest(getRoles.type, getRolesSaga);
  yield takeLatest(reactivateUser.type, reactivateUserSaga);
}
