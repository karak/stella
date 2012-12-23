jQuery(function ($) {
(function (ko, Sammy, nicEditor) {

var nicEdit,
    root;

/** extend knockout */
//contenteditable/user-modify: read-write
ko.bindingHandlers['html-value'] = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        ko.utils.registerEventHandler(element, "blur", function() {
            var modelValue = valueAccessor();
            var elementValue = element.innerHTML;
            if (ko.isWriteableObservable(modelValue)) {
                modelValue(elementValue);
            } else { //handle non-observable one-way binding
                var allBindings = allBindingsAccessor();
                if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers'].htmlValue) {
                    allBindings['_ko_property_writers'].htmlValue(elementValue);
                }
            }
        });
        
        //edit by nickEdit
        nicEdit.addInstance(element);
    },
    update: function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor()) || "";
        element.innerHTML = value;
    }
};

//contenteditable/user-modify: read-write(better is -webkit-user-modify: read-write-plaintext-only)
ko.bindingHandlers['plaintext-value'] = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        ko.utils.registerEventHandler(element, "blur", function() {
            var modelValue = valueAccessor();
            var elementValue = $(element).text();
            if (ko.isWriteableObservable(modelValue)) {
                modelValue(elementValue);
            } else { //handle non-observable one-way binding
                var allBindings = allBindingsAccessor();
                var elementValueAsHtml = $('<span>').text(elementValue).html();
                if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers'].htmlValue) {
                    allBindings['_ko_property_writers'].htmlValue(elementValueAsHtml);
                }
            }
        });
    },
    update: function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor()) || "";
        var valueAsHtml = $('<span>').text(value).html();
        element.innerHTML = valueAsHtml;
    }
};

//draggable
ko.bindingHandlers['position-offset'] = {
    init: function (element, valueAccessor) {
        var position = ko.utils.unwrapObservable(valueAccessor());
        jQuery(element).draggable({
            handle: '>.drag-handle',
            drag: function (e, ui) {
                position.left(ui.position.left);
                position.top(ui.position.top);
            }
        }).css({
            left: position.left(),
            top: position.top()
        });
    },
    update: function(element, valueAccessor) {
        var position =  ko.utils.unwrapObservable(valueAccessor());
        if (typeof (position) === 'function') {
            position = position();
        }
        jQuery(element).css({left: position.left, top: position.top});
    }
};

//contenteditable with list -- ul/ol
(function() {
    function arrayToHtml(textArray) {
        var items = jQuery.map(textArray, function (text) {
            return (text !== ''? '<li>' + jQuery('<span>').text(text).html() + '</li>' : '');
        });
        return items.join('');
    }
    
    function arrayToHtmlValue(textArray) {
        var listItems = arrayToHtml(textArray);
        if (listItems === '') {
            listItems = '<li></li>'; //for list editing
        }
        return listItems;
    }
    
    /** create ul/ol with binding. */
    ko.bindingHandlers['list-text'] =  {
        init: function (element, valueAccessor, allBindingsAccessor) {
        },
        update: function updateFn(element, valueAccessor) {       
            var cannonicalValue = ko.utils.unwrapObservable(valueAccessor());
            jQuery(element).html(arrayToHtml(cannonicalValue));
        }
    };
    
    /** create contenteditable ul/ol.
    prefer element is design-mode :
        HTML:
            <ul class="editable-list" contenteditable></ul>
        
        CSS:
            .editable-list {
                -webkit-user-modify: read-write;
                -moz-user-modify: read-write;
                user-modify: read-write;
            }
    
    */ 
    ko.bindingHandlers['list-value'] =  {
        init: function (element, valueAccessor, allBindingsAccessor) {
            ko.utils.registerEventHandler(element, 'blur', function() {
                var modelValue = valueAccessor();
                var cannonicalValue = jQuery('>li', element).map(function() {
                    return jQuery(this).text();
                }).get();
                var cannonicalValueHtml = arrayToHtmlValue(cannonicalValue);
                
                if (ko.isWriteableObservable(modelValue)) {
                    modelValue(cannonicalValue);
                } else {
                    var allBindings = allBindingsAccessor();
                    if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers'].htmlValue) {
                        allBindings['_ko_property_writers'].htmlValue(cannonicalValueHtml );
                    }
                }
            });
        },
        update: function updateFn(element, valueAccessor) {       
            var cannonicalValue = ko.utils.unwrapObservable(valueAccessor());
            jQuery(element).html(arrayToHtmlValue(cannonicalValue));
        }
    };
}());

/** url helper */
var urls = {
    storyboard: function (projectId) {
        return '#!/projects/' + projectId + '/storyboard';
    }
}

/** viewmodels */
function IssueVM(data) {
    var self = this;

    self.content = ko.observable(data.content || '');
    self.resolved = ko.observable(data.resolved || false);
}

function SceneVM (data) {
    var self = this;
    
    if ('_id' in data) self._id = data._id;
    
    self.title = ko.observable(data.title || '');
    self.events = ko.observable(data.events || []);
    self.consequence = ko.observable(data.consequence || []);
    
    self.remarks = ko.observable(data.remarks || '');
    self.shortenRemarks = ko.computed(function () {
        var full = $('<div>').html(self.remarks()).text();
        return full.length > 80? full.substring(0, 80 - 3) + '...'  : full;
    }, self);

	//issues
	self.issues = ko.observableArray(ko.utils.arrayMap(data.issues, function (data) { return new IssueVM(data); }));
    self.addIssue = function () {
        self.issues.push(new IssueVM({}));
    };
    self.removeIssue = function (item) {
        self.issues.remove(item);
    };

    self.saveForm = function (data) {
        var ns = 'scenes';
        data[ns] = data[ns] || [];
        var mine = {
			title: self.title(),
            events: self.events(),
            consequence: self.consequence(),
			remarks: self.remarks(), 
			issues: ko.utils.arrayMap(self.issues(), function (issue) { return {
				content: issue.content(),
				resolved: issue.resolved()
			}})
		};
        if ('_id' in self) {
            mine._id = self._id;
        }
        if ('_destroy' in self) {
            mine._destroy = self._destroy;
        }
        data[ns].push(mine);
    };
    
    //selection
    self.selected = ko.observable(false);
    self.toggleSelected = function () {
        self.selected(!self.selected());
    };
	return this;
}

function forEach (array, fn) {
    var i, n = array.length, item;
    for (i = 0; i < n; ++i) {
        item = array[i];
        if (fn.call(item, i, item) === false) break;
    }
}

function reverseForEach (array, fn) {
    var i, n = array.length, item;
    for (i = n - 1; i >= 0; --i) {
        item = array[i];
        if (fn.call(item, i, item) === false) break;
    }
}

function ProjectVM(projectId) {
    var self = this;

    self._id = projectId;

    self.scenes = ko.observableArray([]);
    self.insertSceneAfter = function (before) {
        var newScene = new SceneVM({});
        var index = self.scenes.indexOf(before);
        if (index !== -1) {
            self.scenes.splice(index + 1, 0, newScene);
        } else {
            self.scenes.push(newScene);
        }
    };
    self.moveSceneUp = function () {
        self.scenes.valueWillMutate();
        forEach(self.scenes(), function (index, target) {
            var before;
            if (target.selected()) {
                if (index !== 0) {
                    before = self.scenes()[index - 1];
                    self.scenes().splice(index - 1, 2, target, before);
                    //ATTENTION: must unwrap scene not to notify 'delete'.
                }
            }
        });
        self.scenes.valueHasMutated();
    };
    self.moveSceneDown = function () {
        var scenes = self.scenes();
        var lastIndex = scenes.length - 1;
        self.scenes.valueWillMutate();
        reverseForEach(scenes, function (index, target) {
            var after;
            if (target.selected()) {
                if (index !== lastIndex) {
                    after = scenes[index + 1];
                    scenes.splice(index, 2, after, target);
                }
            }
        });
        self.scenes.valueHasMutated();
    };
    
    self.synchronizing = ko.observable(false);
    
    self.save = function () {
		if (self.synchronizing()) return;

		self.synchronizing(true);
        var data = {};
        ko.utils.arrayForEach(self.scenes(), function (item) { item.saveForm(data); });
		console.log('post:', data);
        $.ajax({
            url: '/projects/' + self._id,
            type: 'post',
            contentType: 'application/json',
            data: JSON.stringify(data),
			success: function (response) {
				var i, n, scenes, scene, result, toRemove;
				self.scenes.valueWillMutate();
				scenes = self.scenes();
				n = scenes.length;
				toRemove = [];
				for (i = 0; i < n; ++i) {
					scene = scenes[i], result = response.scenes[i];
					if (result !== null && result !== undefined) {
						if (scene._destroy) {
							toRemove.push(scene);
						} else {
							if ('_id' in scene) {
							} else {
								scene._id = result._id;
								scene.title(result.title);
								scene.remarks(result.remarks);
							}
						}
					} else {
					}
				}
				$.each(toRemove, function (){ self.scenes.remove(this); });
				self.scenes.valueHasMutated();
			}
        });
		self.synchronizing(false);
    };
    
    self.load = function () {
		if (self.synchronizing()) return;

		self.synchronizing(true);
        $.getJSON('projects/' + self._id +'/scenes.json', function (response) {
			self.scenes($.map(response, function (data) { return new SceneVM(data); }));
			self.synchronizing(false);
			//TODO: failure case
        });
    };
    
    self.destroy = function () {
		if (self.synchronizing()) return;

        ko.utils.arrayForEach(self.scenes(), function (item) {
            if (item.selected() && item._destroy !== true) {
                self.scenes.destroy(item);
            }
        });
    };
    
    /* url helpers */
    self.storyboardUrl = ko.computed(function () {
        return urls.storyboard(self._id);
    });
    
    return this;
}

function NotepadWidgetVM() {
    var self = this;
    
    self.minimized = ko.observable(true);
    self.minimize = function () {
        self.minimized(true);
    };
    self.unminimize = function () {
        self.minimized(false);
    };
}

nicEdit = new nicEditor({
    buttonList : [
        'forecolor', 'bold','italic','underline', 'link', 'unlink',
        'indent', 'outdent',
        'left', 'center', 'right', 'justify',
        'ol', 'ul', 
        'hr', /*'image', 'upload',*/
        'xhtml'
    ],
    iconsPath: '/images/nicEditorIcons.gif',

});

root = (new function () {
	var self = this;

	self.selectedProject = ko.observable(null); //TODO: rename to active
    
    self.activeScene = ko.observable(null);
    self.prevOfActiveScene = ko.computed(function () {
        var current = self.activeScene();
        if (current === null) return null;
        
        var scenes =  self.selectedProject().scenes(),
            currentIndex = scenes.indexOf(current);
        if (currentIndex === 0 || currentIndex === -1) {
            return null;
        } else {
            return scenes[currentIndex - 1];
        }
    }, self);
    self.nextOfActiveScene = ko.computed(function () {
        var current = self.activeScene();
        if (current === null) return null;
        
        var scenes =  self.selectedProject().scenes(),
            currentIndex = scenes.indexOf(current);
        if (currentIndex === scenes.length - 1 || currentIndex === -1) {
            return null;
        } else {
            return scenes[currentIndex + 1];
        }
    }, self);
    
    self.activateScene = function (scene) {
        if (self.selectedProject().scenes.indexOf(scene) === -1) return;
        
        self.activeScene(scene);
        $('#scene-edit .scene-remarks-edit').focus();
    };
    self.activatePrevScene = function () {
        var scene = self.prevOfActiveScene();
        if (scene !== null) {
            self.activateScene(scene);
        }
    };
    self.activateNextScene = function () {
        var scene = self.nextOfActiveScene();
        if (scene !== null) {
            self.activateScene(scene);
        }
    };
    self.deactivateScene = function () {
    	self.activeScene(null);
    };

	self.dashboard = (new function () {
		var self = this;
		self.projectSummary = (new function () {
			var self = this;
			self.items = ko.observableArray([]);

			self.loading = ko.observable(false);
			self.load = function () {
				if (self.loading()) return;
				self.loading(true);
				//TODO: return promise
				$.getJSON('/projects/summary.json', function (response) {
					self.items(ko.utils.arrayMap(response, function (data) {
						return data;
					}));
					self.loading(false);
				});
			};
		} ());

		self.load = function () {
			self.projectSummary.load();
		};
	} ());
    
    self.storyboard =ko.observable(false); //TODO: make object and let it have functions moved out of self.
    self.home = ko.computed(function () {
        return !self.storyboard();
    }, self);

	self.goToDashboard = function () {
		self.dashboard.load(); //refresh!
		self.selectedProject(null).
            activeScene(null);
	};
    
    var selectProjectById = function (projectId) {
        var current = self.selectedProject();
        if (current === null || current._id !== projectId) {
            var newProject = new ProjectVM(projectId);
            newProject.load();
            self.selectedProject(newProject);
        }
    };
    
	self.goToProjectStoryboard = function (projectId) {
        selectProjectById(projectId);
        self.storyboard(true);
        self.activeScene(null);
	};
    
    self.goToProjectHome = function (projectId) {
        selectProjectById(projectId);
        self.activeScene(null);
        self.storyboard(false);
    };
    
    self.notepadWidget = new NotepadWidgetVM();
    
} ());

/* bind viewmodels with document */
ko.applyBindings(root);

/* create panel with save action of the project view-model */
nicEdit.setPanel('myNicPanel');

/* init & run routing */
Sammy(function () {
    this.get('/', function () {
        //this.redirect('#!/dashboard');
        this.redirect('#!/projects/1');
    });
    
    this.get(urls.storyboard(':projectId'), function () {
        root.goToProjectStoryboard(this.params.projectId);
    });
    
    this.get('#!/projects/:projectId', function () {
        root.goToProjectHome(this.params.projectId);
    });
    
    this.get('#!/dashboard', function () {
        root.goToDashboard();
    });
}).run();

} (ko, Sammy, nicEditor));
});
