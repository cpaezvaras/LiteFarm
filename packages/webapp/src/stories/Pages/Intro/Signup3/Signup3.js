import Form from '../components/Form';
import PropTypes from 'prop-types';
import Button from '../../../Button';
import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './styles.scss';
import Input from '../../../Form/Input';

import { useForm } from 'react-hook-form';
import { VscLocation } from "react-icons/vsc";

import Script from 'react-load-script';

export function PureSignup3({ title, inputs = [{}, {}], onSubmit }) {
  const { title: titleClass, ...inputClasses } = styles;
  return <Form onSubmit={onSubmit} buttonGroup={<Button type={'submit'} fullLength>Continue</Button>}>
    <h4 className={clsx(styles.title)}>{title}</h4>
    <Input classes={inputClasses} {...inputs[0]} />
    <Input classes={inputClasses} {...inputs[1]} />
  </Form>
}

PureSignup3.prototype = {
  onSubmit: PropTypes.func,
  inputs: PropTypes.arrayOf(PropTypes.exact({ label: PropTypes.string, info: PropTypes.string, icon: PropTypes.node })),
}

export default function Signup3() {
  const { register, handleSubmit, getValues, setValue, errors } = useForm();
  const ref0 = register({ required: { value: true, message: 'Farm name is required' } });
  const ref1 = register({
    required: { value: true, message: 'Address is required' }, validate: {
      value: data => address && gridPoints && data[address],
      message: "Invalid address"
    },
  });
  const FARMNAME = 'farmName';
  const ADDRESS = 'address';
  const [address, setAddress] = useState('');
  const [gridPoints, setGridPoints] = useState({});
  const onSubmit = (data) => {
    console.log(gridPoints, address, getValues(FARMNAME), data);
  }


  let autocomplete;
  const handlePlaceChanged = () => {
    const gridPoints = {};
    const place = autocomplete.getPlace();
    const coordRegex = /^(-?\d+(\.\d+)?)[,\s]\s*(-?\d+(\.\d+)?)$/;
    const isCoord = coordRegex.test(getValues(ADDRESS));


    if (!place.geometry && !isCoord) {
      console.log('reset');
      // setValue(ADDRESS, '');
      setAddress('');
      setGridPoints({});
      return;
    }
    if (isCoord) {
      return;
    }
    setAddress(place.formatted_address);
    gridPoints['lat'] = place.geometry.location.lat();
    gridPoints['lng'] = place.geometry.location.lng();
    setGridPoints(gridPoints);
  }
  const handleScriptLoad = () => {
    const options = {
      types: ['address'],
    };

    // Initialize Google Autocomplete
    /*global google*/ // To disable any eslint 'google not defined' errors
    autocomplete = new google.maps.places.Autocomplete(
      document.getElementById('autocomplete'),
      options,
    );

    // Avoid paying for data that you don't need by restricting the set of
    // place fields that are returned to just the address components and formatted
    // address.
    autocomplete.setFields(['geometry', 'formatted_address']);

    // Fire Event when a suggested name is selected
    autocomplete.addListener('place_changed', handlePlaceChanged);
  }

  const getGeoLocation = () => {
    navigator.geolocation.getCurrentPosition(function(position) {
      console.log("Latitude is :", position.coords.latitude);
      console.log("Longitude is :", position.coords.longitude);
    });
  }

  return <>
    <Script
      url={`https://maps.googleapis.com/maps/api/js?key=AIzaSyDNLCM0Fgm-_aF1x96paf-vdGzCAW6GRHM&libraries=places,drawing,geometry`}
      onLoad={handleScriptLoad}
    />
    <PureSignup3 onSubmit={handleSubmit(onSubmit)} title={'Tell us about your farm'} inputs={[{
      label: 'Farm name',
      inputRef: ref0,
      name: FARMNAME,
      errors: errors[FARMNAME] && errors[FARMNAME].message,
    }, {
      label: 'Farm location',
      info: 'Street address or comma separated latitude and longitude (e.g. 49.250945, -123.238492)',
      icon: <VscLocation size={27} onClick={getGeoLocation}/>,
      inputRef: ref1,
      id: 'autocomplete',
      name: ADDRESS,
      errors: errors[ADDRESS] && errors[ADDRESS].message,
    }]}/>
  </>
}