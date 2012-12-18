(function ($, ko) {
    
function SceneVM (data) {
    var self = this;
    
    self.title = ko.observable(data.title || '');
    self.titleEditing = ko.observable(false);
    self.editTitle = function () {
        self.titleEditing(true);
    };
    
    self.content = ko.observable(data.content);
}

function AnnnotationVM (data) {
    var self = this;
    
    self.position = ko.observable({
        left: ko.observable(data.position.left),
        top: ko.observable(data.position.top)
    });
    
    self.content = ko.observable(data.content);
}

function ProjectVM() {
    var self = this;
    self.scenes = ko.observableArray([]);
    
    self.annotations = ko.observableArray([
        new AnnnotationVM({position: { left: 10, top: 10 }, content: '...'})
    ]);
    
    self.save = function () {
        $.ajax({
            url: '/projects/1',
            type: 'post',
            contentType: 'application/json',
            data: ko.toJSON(self)
        })
    };
    
    self.load = function () {
        $.getJSON('projects/1/scenes.json', function (response) {
            self.scenes(
                $.map(response, function (data) { return new SceneVM(data); })
            );
        });
    };
}

var theProject = new ProjectVM();
theProject.load();
ko.applyBindings(theProject);

} (jQuery, ko));
