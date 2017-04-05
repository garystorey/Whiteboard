/* global module */

module.exports = function () {

    'use strict';

    var config = {

        //Files are listed in order they will be concatinated together
        src: ['./libs/jquery.min.js','./libs/p5.min.js','./libs/spectrum.js','./src/wb.js'],

        linting: {
            files : ['./src/wb.js'],
            settings : {
                formatter: "prose",
                configuration: ".eslintrc"
            },
            reporter :{
                summarizeFailureOutput: true
            }
        },

        dest: {
            folder: './public',
            filename: 'wb.js',
            minFilename : 'wb.min.js'
        },

        css: {
            src: ['./src/wb.scss'],
            dest: './puplic/bundle.css'
        }

    };
    //the config object gets returned to the gulpfile
    return config;
};
