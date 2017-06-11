module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-run');
	grunt.loadNpmTasks('grunt-text-replace');
	grunt.loadNpmTasks('grunt-typescript');
	
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
				],
			}
		},
		copy: {
			all: {
				src: [
					'images',
					'*.css',
					'*.htm',
				], dest: 'dist/'
			},
		},
		typescript: {
			all: {
				src: ['src/**/*.ts'],
				dest: 'dist/js/',
				options: {
					target: 'es6',
					sourceMap: true,
					declaration: true,
				},
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
		'typescript:all',
		'replace:all',
		'copy:all',
		'run:build',
	]);
};

