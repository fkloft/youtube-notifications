module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-run');
	grunt.loadNpmTasks('grunt-text-replace');
	grunt.loadNpmTasks('grunt-typescript');
	
	try {
		var webExt = grunt.file.readJSON('web-ext.json');
	} catch(e) {
		grunt.log.warn("No web-ext.json found, won't be able to sign/submit.");
		var webExt = {};
	}
	
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		clean: {
			all: {
				src: [ 'dist/' ],
			}
		},
		replace: {
			all: {
				src: [ 'manifest.json', ],
				dest: 'dist/',
				replacements: [
					{ from: '@@VERSION@@', to: '<%= pkg.version %>' },
					{ from: '@@AUTHOR@@', to: '<%= pkg.author %>' },
					{ from: '@@HOMEPAGE@@', to: '<%= pkg.homepage %>' },
				],
			}
		},
		copy: {
			all: {
				expand: true,
				src: [
					'images/**',
					'*.css',
					'*.htm',
				], dest: 'dist/'
			},
		},
		typescript: {
			options: {
				target: 'es6',
				declaration: false,
				sourceMap: false,
				noImplicitAny: true,
				references: [
					"src/**/*.d.ts",
				],
			},
			
			popup: {
				src: ['src/popup.ts'],
				dest: 'dist/js/',
			},
			background: {
				src: ['src/background.ts'],
				dest: 'dist/js/',
			},
		},
		run: {
			build: {
				cmd: 'web-ext',
				args: [
					"build",
					"-s", "dist",
				],
			},
			submit: {
				cmd: 'web-ext',
				args: [
					"sign",
					"-s", "dist",
					"--api-key", webExt["API_KEY"],
					"--api-secret", webExt["API_SECRET"],
				],
			},
		},
		watch: {
			files: [
				'src/**',
				'images/**',
				'*.css',
				'*.htm',
				'*.json',
				'Gruntfile.js',
			],
			tasks: ['default'],
		},
	});
	
	grunt.registerTask('default', [
		'clean:all',
		'replace:all',
		'copy:all',
		'typescript:popup',
		'typescript:background',
	]);
	grunt.registerTask('build', [
		'default',
		'run:build',
	]);
	grunt.registerTask('submit', [
		'default',
		'run:submit',
	]);
};

