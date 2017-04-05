'use strict'

import g from 'gulp'
import gulpLoadPlugins from 'gulp-load-plugins'
import config from './config/gulp.config.js'

var gp = gulpLoadPlugins()
var cfg = config()

var plumberSettings = {errorHandler: onError}

var onError = ( err, bEnd = false ) => {
    console && console.log( err.message )
    bEnd && this.emit( 'end' )
};

g.task('sass', () => {
    return g.src( cfg.css.src )
        .pipe( gp.concat('bundle.css'))
        .pipe( gp.sass())
        .pipe( gp.autoprefixer( 'last 3 versions' ) )
        .pipe( gp.cssfmt())
        .pipe( g.dest( cfg.dest.folder  ) )
        .pipe( gp.cleanCss({compatibility: 'ie11'}), function(details) {
            console.log(details.name + ': ' + details.stats.originalSize)
            console.log(details.name + ': ' + details.stats.minifiedSize)
        })
        .pipe( gp.rename( { suffix : '.min' } ) )
        .pipe( g.dest( cfg.dest.folder ) )
        .pipe( gp.notify('Sass Task completed'))
})

g.task( 'lint', () => {
    return g.src( './src/wb.js' )
        .pipe( gp.eslint( cfg.linting.settings ) )
        .pipe( gp.eslint.format())
        .pipe( gp.eslint.failAfterError())
        .pipe( gp.notify('Lint Task completed'))
})

g.task( 'build', () => {
    return g.src( './src/wb.js' )
        .pipe( gp.plumber( plumberSettings ) )
        .pipe( gp.eslint( cfg.linting.settings ) )
        .pipe( gp.eslint.format())
        .pipe( gp.eslint.failAfterError())
        .pipe( gp.babel())
        .pipe( g.dest( cfg.dest.folder ) )
        .pipe( gp.uglify())
        .pipe( gp.rename( cfg.dest.minFilename ) )
        .pipe( g.dest( cfg.dest.folder ) )
        .pipe( gp.notify('Build Task completed'))
});

g.task( 'bump:major', () => {
    g.src( './package.json' )
        .pipe( gp.bump( { type: 'major'} ) )
        .pipe( g.dest( './' ) )
});

g.task( 'bump:minor', () => {
    g.src( './package.json' )
        .pipe( gp.bump( { type: 'minor'} ) )
        .pipe( g.dest( './' ) )
});

g.task( 'bump', () => {
    g.src( './package.json' )
        .pipe( gp.bump() )
        .pipe( g.dest( './' ) )
});

g.task('watch', () => {
    g.watch('./src/wb.js', ['build','bump'])
    g.watch( './src/wb.scss' , ['sass'] )
});

g.task('refresh',['build','sass'], (cb) =>{
    if (cb) cb()
})

g.task('release', ['bump:minor','build'])

g.task('default', ['watch'])

