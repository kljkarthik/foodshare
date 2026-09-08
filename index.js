const express = require('express');
const { createApp } = require('./backend/createApp');

const app = createApp();

module.exports = app;
