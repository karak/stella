jQuery(function ($) {

//knockout singleton
//var ko = ko;

//instanciate nicEditor
var nicEdit;

/** extend knockout */
//contenteditable
ko.bindingHandlers.htmlValue = {
    init: function(element, valueAccessor, allBindingsAccessor) {
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
    self.titleEditing = ko.observable(false);
    self.editTitle = function () {
        self.titleEditing(true);
    };
    
    self.content = ko.observable(data.content || '<p></p>');

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
			content: self.content(), 
			issues: ko.utils.arrayMap(self.issues(), function (issue) { return {
				content: issue.content(),
				resolved: issue.resolved()
			}})
		};
        if ('_id' in self) {
            mine['_id'] = self._id;
        }
        if ('_destroy' in self) {
            mine['_destroy'] = self._destroy;
        }
        data[ns].push(mine);
    };
    
    //selection
    self.selected = ko.observable(false);
    self.toggleSelected = function () {
        self.selected(!self.selected());
    }
	return this;
}

function AnnnotationVM (data) {
    var self = this;
    
    self.position = ko.observable({
        left: ko.observable(data.position.left),
        top: ko.observable(data.position.top)
    });
    
    self.content = ko.observable(data.content);
}

function ProjectVM(projectId) {
    var self = this;

    self.projectId = projectId;

    self.scenes = ko.observableArray([]);
    self.insertSceneAfter = function (before) {
        var index = self.scenes.indexOf(before);
        if (index === 1) {
            index = self.scenes.length;
        }
        self.scenes.splice(index + 1, 0, new SceneVM({}));
    }
    
    self.annotations = ko.observableArray([
        new AnnnotationVM({position: { left: 10, top: 90 }, content: '...'})
    ]);

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
								scene.content(result.content);
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
    }
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

var root = (new function () {
	var self = this;

	self.selectedProject = ko.observable(null);

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
		self.selectedProject(null);
		self.dashboard.load(); //refresh!
	};

	self.goToProject = function (projectId) {
		var theProject = new ProjectVM(projectId);
		theProject.load();
		self.selectedProject(theProject);
	};

} ());

ko.applyBindings(root);
/* create panel with save action of the project view-model */
nicEdit.setPanel('myNicPanel');

//initial page
root.goToDashboard();

});
