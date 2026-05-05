"use strict";
const QRCode = require("qrcode");

const generateDataURL = (text) =>
  QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
  });

const generateBuffer = (text) =>
  QRCode.toBuffer(text, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
  });

module.exports = { generateDataURL, generateBuffer };
