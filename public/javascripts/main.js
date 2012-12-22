jQuery(function ($) {
(function (ko, Sammy, nicEditor) {

var nicEdit,
    root;

/** extend knockout */
//contenteditable
ko.bindingHandlers.htmlValue = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        jQuery(element).attr('contenteditable', 'true'); //TODO: rewrite -> not using jQuery
        ko.utils.registerEventHandler(element, "blur", function() {
            var modelValue = valueAccessor();
            var elementValue = element.innerHTML;
            if (ko.isWriteableObservable(modelValue)) {
                modelValue(elementValue);
            } else { //handle non-observable one-way binding
                var allBindings = allBindingsAccessor();
                if (allBindings['_ko_property_writers'] && allBindings['_ko_property_writers'].htmlValue) allBindings['_ko_property_writers'].htmlValue(elementValue);
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

//draggable
ko.bindingHandlers.positionOffset = {
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
    self.consequence = ko.observable('<ul><li></li></ul>'); //TODO: map array and simple <ul> element;
    
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

    self.saveForm = function (data) {
        var ns = 'scenes';
        data[ns] = data[ns] || [];
        var mine = {
			title: self.title(),
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

function ProjectVM(projectId) {
    var self = this;

    self.projectId = projectId;

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
        ko.utils.arrayForEach(self.scenes(), function (target) {
            if (target.selected) {
                var index = self.scenes.indexOf(target),
                    before;
                if (index !== 0 && index !== -1) {
                    before = self.scenes()[index - 1];
                    self.scenes().splice(index - 1, 2, target, before);
                    //ATTENTION: must unwrap scene not to notify.
                }
            }
        });
    };
    self.moveSceneDown = function () {
        ko.utils.arrayForEach(self.scenes(), function (target) {
            if (target.selected) {
                var index = self.scenes.indexOf(target),
                    after;
                if (index !== self.scenes().length - 1 && index !== -1) {
                    after = self.scenes()[index + 1];
                    self.scenes().splice(index, 2, after, target);
                }
            }
        });
    };
    
    self.synchronizing = ko.observable(false);
    
    self.save = function () {
		if (self.synchronizing()) return;

		self.synchronizing(true);
		console.log(self.scenes());
        var data = {};
        ko.utils.arrayForEach(self.scenes(), function (item) { item.saveForm(data); });
		console.log('post:', data);
        $.ajax({
            url: '/projects/1',
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
				};
				$.each(toRemove, function (){ self.scenes.remove(this); });
				self.scenes.valueHasMutated();
			}
        });
		self.synchronizing(false);
    };
    
    self.load = function () {
		if (self.synchronizing()) return;

		self.synchronizing(true);
        $.getJSON('projects/'+projectId+'/scenes.json', function (response) {
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
    self.activateScene = function (scene) {
        if (root.selectedProject().scenes.indexOf(scene) === -1) return;
    	
    	self.activeScene(scene);
    	$('#scene-edit .scene-remarks-edit').focus();
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

	self.goToDashboard = function () {
		self.dashboard.load(); //refresh!
		self.selectedProject(null).
            activeScene(null);
	};

	self.goToProject = function (projectId) {
		var theProject = new ProjectVM(projectId);
		theProject.load();
		self.selectedProject(theProject).
            activeScene(null);
	};
    
    self.notepadWidget = new NotepadWidgetVM();
    
} ());

/* bind viewmodels with document */
ko.applyBindings(root);

/* create panel with save action of the project view-model */
//nicEdit.setPanel('myNicPanel');

/* create panel with save action of the project view-model 
   attention: create and move since you must call when it is visible*/
(function () {
    var e = document.getElementById('myNicPanel');
    nicEdit.setPanel(e);
    //document.getElementById('sceneEdit').appendChild(e);
} ());

/* init & run routing */
Sammy(function () {
    this.get('/', function () {
        //this.redirect('#!/dashboard');
        this.redirect('#!/projects/1');
    });
    
    this.get('#!/projects/:projectId', function () {
        root.goToProject(this.params.projectId);
    });
    
    this.get('#!/dashboard', function () {
        root.goToDashboard();
    });
}).run();

} (ko, Sammy, nicEditor));
});
